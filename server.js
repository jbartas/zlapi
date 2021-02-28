/* server.js
 *
 * node server.js for zlapi - zoomlink (linkshare) back end.
 */

/**** Express and Frameworks section ***/
console.log("Server.js: loading express and Frameworks");
const express = require('express');
const app = express();
const router = express.Router();
var session = require('express-session')
var credentials = require("./credentials.js");


const bcrypt = require('bcrypt');
var path = require('path');
var cors = require('cors');  // The CORS developers should be shot dead.
const   ObjectID = require('mongodb').ObjectID;


// parse the POST variables into the request body
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());


// static resources
app.use(express.static(__dirname + '/public'));

// need cookies for sessions
var cookieParser = require("cookie-parser");
app.use( cookieParser(credentials.cookieSecret));

// Use express-session package for session mgt.
let sess_data = { resave: true ,
        secret: 'Meatcake', saveUninitialized: true};
app.use(session(sess_data));

/**** Express and Frameworks section ***/
// Get DB schemas and collection entry points
const zlDb = require('./zldb.js');
const zlUser = zlDb.getzlUser();
const zlLinks = zlDb.getzlLinks();
const zlGroup = zlDb.getzlGroup();
const zlLinkList = zlDb.getzlLinkList();
const zlLogin = zlDb.getzlLogin();


// User session managment
let sessions = require('./zlsessions.js');

/**** The actual zoomlinks server logic ***/


// GET request to the homepage
app.get('/', (req, res) => {

    console.log("Non-API GET request: ", req.url );

    let login_msg = sessions.check_session( req.session );
    let hide_msg = "hidden";
    res.sendFile('index.html', {
        root: '.'
    });

    //let hide_msg = "visible";
    //res.render('home', { "login_msg" : login_msg, "hide": hide_msg } );
});



// ************** API SECTION **********************
// REGISTER OUR API ROUTES THROUGH THE ROUTER-------------------------------
// all of our routes will be prefixed with /api
router.use(function(req, res, next) {
    // do logging
    console.log("Router: ", req.url );
    next(); // make sure we go to the next routes and don't stop here
});

app.use('/zlapi', router);


// test GET to root of API (localhosost:8080/zlapi) 
router.route('/').get( function (req, res) {
    console.log("router: API - root (/api) body: ", req.body, " params ", req.params );

    res.json( { "status":"success" } );
});

/* Looks like axios on the Vue front end is broken when it comes 
 * to sending data (like our hash) in a GET request body. So we 
 * use a POST to log in. 
 */

router.route('/login').post( function (req, res) {

    console.log(" /login api POST request; params: ", req.params, " , body: ", req.body );

    let user = {"userName": req.body.userName };
    zlUser.find( user, 
        (err, result)  => {
        console.log("Auth find(user) result: ", result );

        if( result.length == 1 ) {
            console.log("found user");

            // Check the password 
            console.log("user result[0]:", result[0]);
            if(bcrypt.compareSync( req.body.password, result[0].password )) {
                console.log( "User " + user.userName + " - password OK." );
            } else {
                console.log("password mismatch");
                res.json( { "status":"error", "message": "password mismatch" } );
		return;
            }
            let hash = bcrypt.hashSync( user.userName, 10 );
            let session = { "name": user.userName, "hash": hash }

            if( !req.session ) {
                console.log( "Null req.session" );
                res.json( { "status":"error", "message": "Session error on server" } );
            }
            else {
                req.session.cookie.name = user.userName;
            }

            sessions.set_session( session );

            // record the login in DB
            let newlogin = {
                "userId"     : result[0]._id,
                "name"       : user.userName,
                "loginDate"  : new Date,
                "logoutDate" : null,         // Date/time logged out or null.
                "ipAddress"  : req.connection.remoteAddress
            };
            let logindb = new zlLogin( newlogin );    // Create a DB item for the object
            logindb.save( (err, loginResult) => {
                if (err) {
                    res.json( { "status":"error", "message": err } );
                 }
               console.log("/newLink: created" );
            });

            res.json( { "status":"success", "session": req.session,
                "userEmail": result[0].email, "userID":result[0]._id, "sessionHash":hash } );
        }
        else if(result.length == 0) {
            console.log("user not found");
            res.json( { "status":"error", "message": "Unknown user" } );
        }
        else {
            console.log(" DB error: Multiple user records !!!! ");
            res.json( { "status":"error", "message": "Server problem, please notify support." } );
        }
    });

});

/* Record a new link in the users database */
router.route('/newLink').post( function (req, res) {
    console.log(" /newLink api POST request, body: ", req.body );

    /* If passed object has an _id, it's an update to an existing link */
    if( req.body._id ) {
        let filter = { _id: req.body._id };
        let update = req.body;
        console.log("/newLink; update: ", update );

        let newClickCount = zlLinks.findOneAndUpdate(
            filter,
            update,
            { new: true }, (err, result) => {
                if( err ) {
                    console.log("/newLink: link update error: ", err );
                    res.json( { "status":"error", "message": err } );
                }
                else {
                    // no error
                    res.json( { "status":"success", "message": "Updated link",
                            "newLink": result } );
                }
                console.log("/newLink update; done - err: ", err );
        });
        return;
    }
    
    let newLink = req.body;
    let now = new Date;

    /* Add dates to the link object */
    newLink.useDate = now;
    newLink.addDate = now;

    let linkdb = new zlLinks( newLink );    // Create a DB item for the object

    linkdb.save( (err, result) => {
        if (err) {
            res.json( { "status":"error", "message": err } );
            //throw err;
        }
        console.log("/newLink: created" );
        res.json( { "status":"success", "message": "Added new link",
                    "newLink": result  } );
    });
});

/* Delete a link based on passed _id */
router.route('/deleteLink').post( function (req, res) {
    console.log(" /deleteLink api POST request, body: ", req.body );

    del_id = { "_id" : req.body.link_id };

    zlLinks.deleteOne( del_id, (err) => {
        if( err ) {
            console.log("/deleteLink: error: ", err );
            res.json( { "status":"error", "message": err } );
        }
        else {
           // no error
           res.json( { "status":"success", "message": "deleter link" } );
        }
        console.log("/deleteLink; done, err: ", err );    
    });
});


/* Add a new user to the system  */
router.route('/newUser').post( function (req, res) {
    console.log(" /newUser api POST request, body: ", req.body );

    let action = new zlUser( req.body );

    action.save( (err) => {
        if (err) {
            res.json( { "status":"error", "message": err } );
            throw err;
        }
        console.log("/newUser: created" );
        res.json( { "status":"success", "message": "Added new action" } );
    });
});


/* Get the information for a passed user name */
router.route('/getUserInfo/:userName').get( function (req, res) {
    console.log("/getUserInfo, params: ", req.params );

    let query = req.params;

    zlUser.find( query,  (err, result) => {
        if(err) {
            console.log( "API: getUserInfo err", err );
            res.json( { "status":"error", "message": err } );
        }
        else {
            /* Got a result - it may be a zero-length array */
            console.log( result );
            res.json( { "status":"success", "userInfo": result } );
        }
    });
});


/*  Get the information for one or more users passed by _id list */

router.route('/getUserList').post( function (req, res) {
    console.log("/getUserList, params: ", req.body );

    let idList = req.body;
    let obj_ids = idList.map( function(id) { return ObjectID(id); });
    let query = {_id: {$in: obj_ids}};
    zlUser.find( query, (err, result)  => {
        console.log("getUserList: result: ", result, ", err: ", err );
        if( err ) {
            res.json( { "status":"error", "message": err } );
        }
        else {
            res.json( { "status":"success", "userList": result } );
        }
    });
});


/* Get the links for a passed user */
router.route('/getLinks').post( function (req, res) {
    console.log("/getLinks, body: ", req.body );

    /* make sure login hash is valid */
    let session = sessions.check_session( req.body );
    console.log("/getlinks; session is ", session );
    if( session == null ) {
        let msg = "Must be logged in to access links";
        res.json( { "status":"error", "message": msg } );
        return;
    }

    let query = { "userName" : req.body.name };

    zlLinks.find( query, (err, result) => {
        if(err) {
            console.log( "API: getRecords err", err );
            res.json( { "status":"error", "message": err } );
        }
        else {
            if( result.length > 0 ) {
                console.log("found " + result.length + " records");
                // console.log( result );
                res.json( { "status":"success", "recordList": result } );
            }
            else {
                console.log("No link records for user " + req.body.name );
                // return zero length list
                res.json( { "status":"success", "recordList": result } );
            }
        }
    });
});


/* Record a click.   */
router.route('/bumpClick').post( function (req, res) {
    console.log("/bumpClick api POST request, body: ", req.body );

    let now = new Date;
    let filter = { _id: req.body._id };
    let update = { $inc: { "clicks" : 1 }, useDate: now };
    console.log("/bumpClick; update: ", update );
 
    let newClickCount = zlLinks.findOneAndUpdate(
        filter,
        update,
        { new: true }, (err) => {
            console.log("/bumpClick; done - err: ", err );        
    });

    // Opimistically return success without waiting for mongo.
    res.json( { "status":"success", "message": "bumped click" } );
    
});



/* Record creation of a new group */

router.route('/newGroup').post( function (req, res) {

    console.log("/newGroup POST request; body: ", req.body );

    /* If passed object has an _id, it's an update to an existing link */
    if( req.body._id ) {
        let filter = { _id: req.body._id };
        let update = req.body;
        console.log("/newGroup; update: ", update );

        let newClickCount = zlLinks.findOneAndUpdate(
            filter,
            update,
            { new: true }, (err) => {
                if( err ) {
                    console.log("/newLink: link update error: ", err );
                    res.json( { "status":"error", "message": err } );
                }
                else {
                    // no error
                    res.json( { "status":"success", "message": "Updated link" } );
                }
                console.log("/newLink update; done - err: ", err );
        });
        return;
    }
    
    let newGroup = req.body;
    let now = new Date;

    /* Add dates to the link object */
    newGroup.addDate = now;

    let groupdb = new zlGroup( newGroup );    // Create a DB item for the object

    groupdb.save( (err) => {
        if (err) {
            res.json( { "status":"error", "message": err } );
            //throw err;
        }
        console.log("/newGroup: created" );
        res.json( { "status":"success", "message": "Added new link" } );
    });
});


/* Get the groups for a passed user */
router.route('/getGroups/:id').get( function (req, res) {
    console.log("/getGroups, params: ", req.params );
    let query = { "members" : req.params.id };

    zlGroup.find( query, (err, result) => {
        if(err) {
            console.log( "API: getGroups err", err );
            res.json( { "status":"error", "message": err } );
        }
        else {
            if( result.length > 0 ) {
                console.log("found " + result.length + " records");
                // console.log( result );
                res.json( { "status":"success", "groupList": result } );
            }
            else {
                console.log("No group records with id in members; id:" + req.params.id );
                // return zero length list
                res.json( { "status":"success", "groupList": result } );
            }
        }
    });
});


/* Get a group by name (for checking name uniqueness, getting ID, etc.) */

router.route('/getGroupInfo/:groupName').get( function (req, res) {
    console.log("/getGroups, params: ", req.params );
    let query = { "groupName" : req.params.groupName };

    zlGroup.find( query, (err, result) => {
        if(err) {
            console.log( "API: getGroupInfo err ", err );
            res.json( { "status":"error", "message": err } );
        }
        else {
            if( result && (result.length > 0) ) {
                console.log("found " + result.length + " records");
                console.log( result );
                res.json( { "status":"success", "groupList": result } );
            }
            else {
                console.log("No group records of name " + req.params.groupName );
                // return zero length list
                res.json( { "status":"success", "groupList": [] } );
            }
        }
    });
});


/* get list of links in a group */

router.route('/getGroupLinks/').post( function (req, res) {
    console.log("/getGroupLinks, body: ", req.body );

    /* make sure login hash is valid */

/* This may be accessed via 'magic link' where user is not logged in.

    let session = sessions.check_session( req.body );
    console.log("/getGroupLinks; session is ", session );
    if( session == null ) {
        let msg = "Must be logged in to access group links";
        res.json( { "status":"error", "message": msg } );
        return;
    }
*/

    let groupId = req.body.group;

    /* First we need to get the list of link _ids in the group */
    let query = { "_id" : groupId };
    zlGroup.find( query, (err, result) => {
        if(err) {
            console.log( "API: getGroupLinks; bad group _id ? err ", err );
            res.json( { "status":"error", "message": err } );
        }
        else {
            console.log( "API: getGroupLinks; groups: ", result );
            if( result.length > 0 ) {
                console.log("found " + result.length + " records");	// better be 1...
                let links = result[0].links;
                console.log( "links: ", links );	// tmp debug

                /* Now get the records for the links in the group. first
                 * turn object IDs array (of text) into array of mongoose 
                 * Id objects. 
                 */
                let obj_ids = links.map( function(id) { return ObjectID(id); });
                let query = {_id: {$in: obj_ids}};
                console.log( "query: ", query );        // tmp debug
                //let query = {_id: { $in: result.links }}

                // find links which match the listed objects
                zlLinks.find( query, (err, result) => {
                    console.log("getGroupLinks; zlLinks.find result: ", result, 
                            ", err: ", err);
                    if( err ) {
                        res.json( { "status":"error", "message": err } );
                    }
                    else {	// no error
                        res.json( { "status":"success", "recordList": result } );
                    }
                });
            }
            else {
                console.log("No links in group; group Id:", groupId );
                // return zero length list
                res.json( { "status":"success", "recordList": [] } );
            }
        }
    });
});


/* Update a group record  */

router.route('/updateGroup').post( function (req, res) {
    console.log(" /updateGroup api POST request, body: ", req.body );

    let filter = { _id: req.body._id };
    let update = req.body;

    zlGroup.findOneAndUpdate( filter, update, { new: true }, (err, doc) => {
        if( err ) {
            console.log("/updateGroup: error: ", err );
            res.json( { "status": "error", "message": err } );
        }
        else {
            // no error
            res.json( { "status":"success", "result": doc } );
       }
       console.log("/updateGroup; done - err: ", err );
    });
});

/* Update the user/admins in a group. 
 * Passed parameter is an object with command info.
 */

router.route('/setGroupUsers').post(  function (req, res) {

    console.log(" /setGroupUsers api POST request, body: ", req.body );
    /* Steps for this are:
     * - Get an ID for the user name
     * - read in the group
     * - add the user ID to group members or admins
     * - update the group
     */
    let user = {"userName": req.body.userName };
    zlUser.find( user, 
        (err, result)  => {
            console.log("Auth find(user) result: ", result, ", err: ", err );
            if( err ) {
                console.log("user not found");
                res.json( { "status":"error", "message": "Unknown user" } );
            }
            else {
                if( result.length == 1 ) {
                    console.log("found user");
                    let userId = result[0]._id.toString();   // Save ID for later

                    /* Step 2 - read in the group */
                    let query = { "groupName": req.body.groupName };
                    zlGroup.find( query, (err, result) => {
                        if(err) {
                            console.log( "API: getGroups err", err );
                            res.json( { "status":"error", "message": err } );
                        }
                        else {
                            if( result.length == 1 ) {
                                // found our group, Step 3:
                                group = result[0];
                                console.log("Found group: ", group );
                                let adminIndex = group.admins.indexOf( userId );
                                let memberIndex = group.members.indexOf( userId );
                                let errmsg = null;	// use this as soft error flag

                                if( req.body.operation == "delete" ) {
                                    if( req.body.usertype == "admin" ) {
                                        if (adminIndex == -1) {
                                            console.log("Admin not found in group");
                                        }
                                        else {
                                            if( group.admins.length == 1 ) {
                                                errmsg = "Skipping delete of only admin";
                                                console.log( errmsg );
                                            }
                                            else {
                                                group.admins.splice(adminIndex, 1);
                                            }
                                        }
                                    }
                                    else {
                                        // usertype != admin
                                        if (memberIndex == -1) {
                                            errmsg = "Member not found in group";
                                            console.log( errmsg );
                                        }
                                        else {
                                            group.members.splice(memberIndex, 1);
                                        }
                                    }
                                }
                                else {
                                    // operation != delete, do add
                                    if( req.body.usertype == "admin" ) {
                                        if( adminIndex != -1 ) {
                                            errmsg = "Admin already in group";
                                            console.log( errmsg );
                                        }
                                        else {
                                            group.admins.push( userId );
                                        }
                                    }
                                    else {
                                        // operation != delete and usertype != admin
                                        if( memberIndex != -1) {
                                            errmsg = "member already in group";
                                            console.log( errmsg );
                                        }
                                        else {
                                            group.members.push( userId );
                                        }
                                    }
                                }

                                // report back any soft (logic) error and quit
                                if( errmsg ) {
                                    res.json( { "status":"error", "message": errmsg } );
                                    return;
                                }

                                // group is ready to update.
                                console.log("updating group: ", group );

                                zlGroup.findByIdAndUpdate(
                                    group._id,
                                    group,
                                    { new: true }, (err) => {
                                        console.log("/setGroupUsers; updated - err: ", err );
                                        if( err ) {
                                            res.json( { "status":"error", "message": err } );
                                        }
                                        else {
                                            res.json( { "status":"success", "updatedGroup": group } );
                                        }
                                });

                            }
                            else {
                                console.log("DB serror, found != 1 groups: ", result );
                                res.json( { "status":"error", "message": "Groups DB != 1 error" } );
                            }
                        }
                    });
                }
                else {
                    console.log("user not found or found multiple times");
                    res.json( { "status":"error", "message": "Users != 1 error" } );
                }
            }
        });
});

/* Create a new list */

router.route('/makeLinksList').post( function (req, res) {

    console.log("/makeLinksList POST request; body: ", req.body );

    /* make sure login hash is valid */
    let session = sessions.check_session( req.body );
    console.log("/makelinksList; session is ", session );
    if( session == null ) {
        let msg = "Must be logged in to access lists";
        res.json( { "status":"error", "message": msg } );
        return;
    }

    /* If passed object has an _id, it's an update to an existing link */
    if( req.body._id ) {
        let filter = { _id: req.body._id };
        let update = req.body;
        console.log("/makeLinkList; update: ", update );
        // More here later
        let newClickCountList = zlLinkList.findOneAndUpdate(
            filter,
            update,
            { new: true }, (err, result) => {
                if( err ) {
                    console.log("/makeLinkList: link update error: ", err );
                    res.json( { "status":"error", "message": err } );
                }
                else {
                    // no error
                    res.json( { "status":"success", "message": "Updated list",
                            "newList": result } );
                }
                console.log("/newList update; done - err: ", err );
        });

    }
    else {

        let newList = req.body;
        let now = new Date;

        /* Set Create time/date for the list */
        newList.createDate = now;

        let listdb = new zlLinkList( newList );    // Create a DB item
        listdb.save( (err) => {
            if (err) {
                res.json( { "status":"error", "message": err } );
                //throw err;
            }
            else {
                console.log("/makeLinkList: created" );
                res.json( { "status":"success", "message": "Created new List" } );
            }
        });
    }

});


/* Get lists owned by passed user  */

router.route('/getLists').post( function (req, res) {
    console.log("/getLists POST request; body: ", req.body );

    /* make sure login hash is valid */
    let session = sessions.check_session( req.body );
    console.log("/getlinks; session is ", session );
    if( session == null ) {
        let msg = "Must be logged in to access links";
        console.log("error, returning ", msg );
        res.json( { "status":"error", "message": msg } );
        return;
    }

    /* Get the list of lists for passed userId */
    let query = { "owner" : req.body.owner };
    console.log( "getLists, query; ", query );

    zlLinkList.find( query, (err, result) => {
        if(err) {
            console.log( "API: getLists; bad userId _id ? err ", err );
            res.json( { "status":"error", "message": err } );
        }
        else {
            console.log( "API: getLists: lists ", result );
            res.json( { "status":"success", "recordList": result } );
        }
    });

});


/* get full record for a list of links */

router.route('/getList').post( function (req, res) {
    console.log("/getList, body: ", req.body );

    /* make sure login hash is valid */
    let session = sessions.check_session( req.body );
    console.log("/getList; session is ", session );
    if( session == null ) {
        let msg = "Must be logged in to access links";
        res.json( { "status":"error", "message": msg } );
        return;
    }

    let query = { "_id" : req.body.listId };
    zlLinkList.find( query, (err, result) => {
        if (err) {
            res.json( { "status":"error", "message": err } );
            //throw err;
        }
        else {
            console.log("/getList: returning list named ", result.name );
            res.json( { "status":"success", "listData": result } );
        }
    });
});


/* Get bulk links data for a passed list of link Ids */

router.route('/getBulkLinks').post( function (req, res) {
    console.log("/getBulkLinks, body: ", req.body );

    /* make sure login hash is valid */
    let session = sessions.check_session( req.body );
    console.log("/getBulkLinks; session is ", session );
    if( session == null ) {
        let msg = "Must be logged in to access links";
        res.json( { "status":"error", "message": msg } );
        return;
    }

    /* Search all links for the passed Ids */
    let query = {_id: {$in: req.body.linkIds}};
    zlLinks.find( query, (err, result)  => {
        console.log("getUserList: result: ", result, ", err: ", err );
        if( err ) {
            res.json( { "status":"error", "message": err } );
        }
        else {
            res.json( { "status":"success", "listLinks": result } );
        }
    });

});

/* Delete a list of links. Id of list is parameters
 */

router.route('/deleteList').post( function (req, res) {
    console.log("/deleteList, body: ", req.body );

    /* make sure login hash is valid */
    let session = sessions.check_session( req.body );
    console.log("/getBulkLinks; session is ", session );
    if( session == null ) {
        let msg = "Must be logged in to access links";
        res.json( { "status":"error", "message": msg } );
        return;
    }

    let query = { "_id" : req.body.listId };

    zlLinkList.deleteOne( query, (err) => {
        if (err) {
            res.json( { "status":"error", "message": err } );
            //throw err;
        }
        else {
            console.log("/deleteList: deleted ", req.body.listId );
            res.json( { "status":"success", "deleted list": req.body.listId } );
        }
    });

});


///------------ The actual server -------------//
console.log("Server.js: Starting Server listen...");

let lport = 3001;

server = app.listen( lport, '0.0.0.0', () => {
    console.log('listen on port 0.0.0.0:', lport);
});



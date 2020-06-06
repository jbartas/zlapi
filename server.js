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

        if( result.length > 0 ) {
            console.log("found user");

            console.log( "setting res.cookie( name )", user.userName );
            res.cookie( "name", user.userName );
            
            if( !req.session ) {
                console.log( "Null req.session" );
            }
            else {
                req.session.name = user.userName;
                req.session.hash = 
                    bcrypt.hashSync( user.userName, 10 );
            }
            sessions.set_session( req.session );
            if( req.cookie ) {
                console.log("Cookie ", req.cookie.name );
            }

            // Lastly, check the password 
            console.log("user result[0]", result[0]);
            if(bcrypt.compareSync( req.body.password, result[0].password )) {                
                console.log( "User " + user.userName +" password OK");
                res.json( { "status":"success", "session": req.session } );
            } else {
                console.log("password mismatch");
                res.json( { "status":"error", "message": "password mismatch" } );
            }
        }
        else {
            console.log("user not found");
            res.json( { "status":"error", "message": "Unknown user" } );
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
    
    let newLink = req.body;
    let now = new Date;

    /* Add dates to the link object */
    newLink.useDate = now;
    newLink.addDate = now;

    let linkdb = new zlLinks( newLink );    // Create a DB item for the object

    linkdb.save( (err) => {
        if (err) {
            res.json( { "status":"error", "message": err } );
            //throw err;
        }
        console.log("/newLink: created" );
        res.json( { "status":"success", "message": "Added new link" } );
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


/* Get the information for a passed user */
router.route('/getUserInfo/:userName').get( function (req, res) {
    console.log("/getUserInfo, params: ", req.params );

    let query = req.params;

    zlUser.find( query,  (err, result) => {
        if(err) {
            console.log( "API: getUserInfo err", err );
            res.json( { "status":"error", "message": err } );
        }
        else {
            if( result.length > 0 ) {
                console.log( result );
                res.json( { "status":"success", "userInfo": result } );
            }
        }
    });
});


/* Get the links for a passed user */
router.route('/getLinks/:name').get( function (req, res) {
    console.log("/getLinks, params: ", req.params );
    let query = { "userName" : req.params.name };

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
                console.log("No link records for user " + req.params.name );
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



///------------ The actual server -------------//
console.log("Server.js: Starting Server listen...");

let lport = 3001;

server = app.listen( lport, '0.0.0.0', () => {
    console.log('listen on port 0.0.0.0:', lport);
});



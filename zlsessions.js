
/* btsessions.js
 *
 * Session handler. If a user is logged in, each request gets 
 * passed a session cookie with a username and session code. We 
 * just verify the name and hash is in  a list.
 */

var sessionList = [];


/* Add a session to the list of active sessions */

module.exports.set_session = function ( session ) {
    session.startTime = Date();
    sessionList.push( session );
    console.log("session added; ", sessionList );
}

/* Check_session returns a login_msg for display on the main page 
 * if the passed session was in the list, 
 *
 * If not found (error) returns null;
 */
module.exports.check_session = function ( session ) {

    // find the session in the active session list
    for( var i = 0; i < sessionList.length; i++ ) {
        if( sessionList[i].hash == session.hash ) {
            return session;
        }
    }
    console.log("check_session: session not found in list");
    return null;  // no session info found
}

/* del_session()
 *
 * delete a session from the active sessoin list. 
 */
module.exports.del_session = function ( session ) {
    for( var i = 0; i < sessionList.length; i++ ) {
        if(sessionList[i].hash == session.hash ) {
            // remove sesionList entry matching hash
           sessionList.splice(i, 1);
           let msg = "Deleted session for " + session.name;
           console.log(msg);
           return msg;
        }
    }
    // We should never get here
    let msg = "Unable to find session in sessionList[]";
    console.log("ERROR: " + msg );
    return msg;
}

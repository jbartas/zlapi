const   mongoose = require('mongoose');
//const   credentials = require("./credentials.js");

console.log("zldb.js: Connecting to database");

//const dbUrl = 'mongodb://' + credentials.username +
//        ':' + credentials.password + '@' + credentials.host + ':' + credentials.port + '/' + credentials.database;

const  dbUrl = 'mongodb://localhost/linkshare' 

console.log(dbUrl);

const connection = mongoose.createConnection(dbUrl, { useNewUrlParser: true } );

const   Schema = mongoose.Schema;
const   ObjectID = require('mongodb').ObjectID;

/* The basic per-user identity records.
*/
const zlUser = new Schema({
    email: String,
    userName: String,
    password: String,
    admin:  Boolean,     // true if Admin
    groups: Array
});


/* This defines the basic single link record.
 */
const zlLinks = new Schema({
    userName: String,   // Owner of link record
    type:     String,   // zoom, webEx, Google Docs, etc.
    linkName: String,   // Name user assigned to link
    linkURL:  String,   // URL for the link
    linkTags: String,  	// search tags
    addDate:  Date,     // date link was added
    useDate:  Date,     // date link was last used
    password: String,   // optional password for link
    clicks:   Number    // Number of time used
})


/* Linkshare groups
 * type == public - Anyone can join, shows up in search
 * type == private - owner must add people,  shows up in search
 * type == hidden - owner must add people, does NOT show up in search
 */

const zlGroup = new Schema({
    ownerName:  String,  // Owner of group
    groupName:  String,
    descriptio: String,
    tags:       String,
    type:       String, // Public, private, hidden
    links:      Array   // Associated link Ids
})


module.exports = {
    getzlUser: () => {
        return connection.model("zlUsers", zlUser);
    },

    getzlLinks: () => {
		return connection.model("zlLinks", zlLinks);
    },

    getzlGroup: () => {
                return connection.model("zlGroup", zlGroup);
    },
    
}

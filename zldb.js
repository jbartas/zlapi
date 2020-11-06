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
    email:    String,
    userName: String,
    password: String,
    admin:    Boolean,  // true if Admin
    groups:   Array,    // _id list for groups
    friends:  Array     // _id list for friends
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
    options:  Array,
    clicks:   Number    // Number of time used
})


/* Linkshare groups
 *
 * type == public - Anyone can view, only members can write, and then
 *     only if the group memberRW is "rw"
 * type == private - Only members can view. Admin must add members.
 *     Members can only write only if the group memberRW is "rw"
 * type == hidden - owner must add people, does NOT show up in search
 *
 * Admins can always read, write, edit group and add members. 
 * Links in group are kept in an ID list so they can ve shared 
 * with other groups and members without copying. If a member 
 * shares a link with a group, then edits made by the member or 
 * someone with group permissions show up in both the group and 
 * the member acctount because of the sharing.
 */

const zlGroup = new Schema({
    admins:     Array,        // Array of admins, by user Id
    groupName:  String,       // Unique name, system wide.
    descr:      String,	      // Description of group
    tags:       String,
    password:   String,	      // optional, to limit non-member access
    type:       String,       // Public, private, hidden
    links:      Array,        // Associated link Ids
    members:   	Array,        // _id list of member users
    memberRW:   String,       // "r" (read) or "rw" (read write)
})

/* Linkshare Lists of links
 *
 */

const zlLinkList = new Schema({
    linkIds:     Array,        // Array of admins, by user Id
    owner:       Object,       // Id of list owning user
    name:        String,       // Name of list, editable by owner
    addDate:     Date,         // Date/time created
    ttl:         Number        // time to live

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

    getzlLinkList: () => {
        return connection.model("zlLinkList", zlLinkList);
    },
}

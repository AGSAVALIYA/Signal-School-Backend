const Logs = require("../models/Logs")


const createLog = (usertype, action, description, userId) => {
    if (!usertype || !action || !description || !userId) {
        return
    }
    if (usertype !== "admin" && usertype !== "teacher") {
        return
    }
    if (usertype === "admin") {
        Logs.create({
            userType: usertype,
            action: action,
            description: description,
            adminId: userId
        })
    }
    if (usertype === "teacher") {
        Logs.create({
            userType: usertype,
            action: action,
            description: description,
            teacherId: userId
        })
    }
}


module.exports = {
    createLog
}

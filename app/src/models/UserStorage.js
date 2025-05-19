" use strict";

class UseStorage {
  static #users = {
    id: ["sungha", "성하박사", "성하"],
    password: ["123", "1234", "12345"],
    nams: ["우리밋", "나개발", "김팀장"],
  };

  static getUsers(...fields) {
    const users = this.#users;
    const newUsers = fields.reduce((newUsers, field) => {
      if (users.hasOwnProperty(field)) {
        newUsers[field] = users[field];
      }
      return newUsers;
    }, {});
    return newUsers;
  }
  static getUsersInfo(id) {
    const users = this.#users;
    const idx = users.id.indexOf(id);
    const userKeys = Object.keys(users);
    const userInfo = userKeys.reduce((newUsers, info) => {
      newUsers[info] = users[info][idx];
      return newUsers;
    }, {});

    return userInfo;
  }
}
module.exports = UseStorage;

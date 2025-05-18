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
}
module.exports = UseStorage;

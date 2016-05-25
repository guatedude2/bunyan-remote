function ClientArray() {
};

ClientArray.prototype = Object.create(Array.prototype);

ClientArray.prototype.indexOf = function (id) {
  return this.reduce(function (result, client, index) {
    return result === -1 && client.id === id ? index : result;
  }, -1);
};

ClientArray.prototype.add = function (client) {
  if (this.indexOf(client.id) === -1) {
    this.push(client);
    return true;
  }
  return false;
};

ClientArray.prototype.remove = function (client) {
  var index = this.indexOf(client.id);
  if (index !== -1) {
    this.splice(index, 1);
    return true;
  }
  return false;
};

ClientArray.prototype.emit = function (event, data) {
  this.forEach(function (client){
    client.emit(event, data);
  });
};

module.exports = ClientArray;
var expect = require('chai').expect;
var sinon = require('sinon');
var ClientArray = require('../../lib/client-array');

var fixtures = {
  clientA: { id: 'ABC', emit: null },
  clientB: { id: 'DEF', emit: null }
};

describe('client-array', function () {
  var clientArray;
  beforeEach(function () {
    clientArray = new ClientArray();
    clientArray.push(fixtures.clientA);
  });

  it('should inherit Array class', function () {
    expect(clientArray instanceof Array).to.be.true;
    expect(clientArray instanceof ClientArray).to.be.true;
  });

  it('`indexOf` should find a client based on id', function () {
    expect(clientArray.indexOf('ABC')).to.be.gt(-1);
    expect(clientArray.indexOf('DEF')).to.be.equal(-1);
  });

  it('`add` should add a client to the client array', function () {
    expect(clientArray.add(fixtures.clientB)).to.be.true;
    expect(clientArray.indexOf('DEF')).to.be.gt(-1);
  });

  it('`add` should ignore a client if a client with the same id exsits', function () {
    expect(clientArray.add(fixtures.clientB)).to.be.true;
    expect(clientArray.indexOf('DEF')).to.be.gt(-1);
    expect(clientArray.length).to.be.equal(2);
    expect(clientArray.add(fixtures.clientB)).to.be.false;
    expect(clientArray.length).to.be.equal(2);
  });

  it('`remove` should remove a client if the id exsits in the array', function () {
    clientArray.add(fixtures.clientB);
    expect(clientArray.indexOf('DEF')).to.be.gt(-1);
    expect(clientArray.length).to.be.equal(2);
    expect(clientArray.remove(fixtures.clientA)).to.be.true;
    expect(clientArray.indexOf('ABC')).to.be.equal(-1);
    expect(clientArray.indexOf('DEF')).to.be.gt(-1);
    expect(clientArray.length).to.be.equal(1);
  });

  it('`emit` should trigger the emit event on all client in the client array', function () {
    fixtures.clientA.emit = sinon.stub();
    fixtures.clientB.emit = sinon.stub();
    clientArray.add(fixtures.clientB);
    clientArray.emit('test', {data: 1234});
    expect(fixtures.clientA.emit.calledWith('test', {data:1234})).to.be.true;
    expect(fixtures.clientB.emit.calledWith('test', {data:1234})).to.be.true;
  });

});
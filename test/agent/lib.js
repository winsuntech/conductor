const sinon = require('sinon')
const UUID = require('uuid')
const request = require('supertest')

const app = require('src/app')

const IDS = {

  alice: {
    uuid:'9f93db43-02e6-4b26-8fae-7d6f51da12af',
    home: 'e2adb5d0-c3c7-4f2a-bd64-3320a1ed0dee',
    global: "ocMvos6NjeKLIBqg5Mr9QjxrP1FA"
  },

  bob: {
    uuid: 'a278930c-261b-4a9c-a296-f99ed00ac089',
    home: 'b7566c69-91f5-4299-b4f4-194df92b01a9',
    global: "ocMvos6NjeKLIBqg5Mr9QjxrP1FB"
  },

  charlie: {
    uuid: 'c12f1332-be48-488b-a3ae-d5f7636c42d6',
    home: '1da855c5-33a9-43b2-a93a-279c6c17ab58',
    global: "ocMvos6NjeKLIBqg5Mr9QjxrP1FC"
  },

  david: {
    uuid: '991da067-d75a-407d-a513-a5cf2191e72e',
    home: 'b33c3449-a5d4-4393-91c5-6453aeaf5f41',
  },

  emma: {
    uuid: 'fb82cf8f-cfbf-4721-a85e-990e3361a7dc',
    home: '37f4b93f-051a-4ece-8761-81ed617a28bd',
  },

  frank: {
    uuid: '50fac2de-84fe-488f-bd06-f1312aa03852',
    home: '0e040acf-198f-427d-a3a3-d28f9fc17564',
  },

  publicDrive1: {
    uuid: '01f7bcfd-8576-4dc5-b72f-65ad2acd82b2',
  }
}

const FILES = {

  alonzo: {
    name: 'alonzo_church.jpg',
    path: 'testdata/alonzo_church.jpg',
    size: 39499, 
    hash: '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408'
  },

  bar: {
    name: 'bar',
    path: 'testdata/bar',
    size: 4,
    hash: '7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730' 
  },

  empty: {
    name: 'empty',
    path: 'testdata/empty',
    size: 0,
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  },

  foo: {
    name: 'foo',
    path: 'testdata/foo',
    size: 4,
    hash: 'b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c'
  },

  hello: {
    name: 'hello',
    path: 'testdata/hello',
    size: 6,
    hash: '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03'
  },

  vpai001: {
    name: 'vpai001',
    path: 'testdata/vpai001.jpg',
    size: 4192863,
    hash: '529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb', 
  },

  world: {
    name: 'world',
    path: 'testdata/world', 
    size: 6,
    hash: 'e258d248fda94c63753607f7c4494ee0fcbe92f1a76bfdac795c9d84101eb317'  
  },
}

const stubUserUUID = username => 
  sinon.stub(UUID, 'v4')
    .onFirstCall().returns(IDS[username].uuid)
    .onSecondCall().returns(IDS[username].home)
    .onThirdCall().throws(new Error('function called more than twice'))

const createUserAsync = async (username, token, isAdmin) => {

  let props = { username, password: username }
  if (isAdmin) props.isAdmin = true

  let req = request(app)
    .post('/users')
    .send(props)
    .expect(200)

  if (token) req.set('Authorization', 'JWT ' + token)

  stubUserUUID(username)
  try {
    let res = await req 
    let real = res.body.uuid 
    let expected = IDS[username].uuid
    if (real !== expected) throw new Error(`user uuid mismatch, real ${real}, expected ${expected}`)
    return res.body
  }
  finally {
    UUID.v4.restore()
  }
}

/**
Retrieve test user's token
*/
const retrieveTokenAsync = async username => 
  (await request(app)
    .get('/token')
    .auth(IDS[username].uuid, username)).body.token

const createPublicDriveAsync = async (props, token, uuid) => {

  if (!token || !uuid) throw new Error('token and uuid must be provided')

  let req = request(app)
    .post('/drives')
    .send(props)
    .set('Authorization', 'JWT ' + token)
    .expect(200)

  sinon.stub(UUID, 'v4').returns(uuid) 
  try {
    let res = await req
    if (res.body.uuid !== uuid) 
      throw new Error(`drive uuid mismatch, real ${res.body.uuid}, expected ${uuid}`)
    return res.body
  }
  finally {
    UUID.v4.restore()
  }
}

const setUserGlobalAsync = async username => {

  let token = await retrieveTokenAsync(username)

  return (await request(app)
    .patch(`/users/${IDS[username].uuid}`)
    .set('Authorization', 'JWT ' + token)
    .send({ global: IDS[username].global })
    .expect(200)).body
}


// only useful for local user
const laCloudTokenAsync = async username => {

  let token = await retrieveTokenAsync(username)

  let res = await request(app)
    .get('/cloudToken')
    .query({ global: IDS[username].global})
    .set('Authorization', 'JWT ' + token)
    .expect(200)

  return res.body.token
}

const waCloudTokenAsync = async (username) => {
  let res = await request(app)
    .get('/cloudToken')
    .query({ global: IDS[username].global})
    .expect(200)
  return res.body.token
}

const createBoxAsync = async (props, username) => {

  let token = await retrieveTokenAsync(username)
  let cloudToken = await laCloudTokenAsync(username)

  let res = await request(app)
    .post('/boxes')
    .send(props)
    .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
    .expect(200)

  return res.body
}

const createBranchAsync = async (props, boxUUID, username) => {
  let token = await retrieveTokenAsync(username)
  let cloudToken = await waCloudTokenAsync(username)

  let res = await request(app)
    .post(`/boxes/${boxUUID}/branches`)
    .send(props)
    .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
    .expect(200)

  return res.body
}

const forgeRecords = async (boxUUID, username) => {
  let token = await retrieveTokenAsync(username)
  let cloudToken = await laCloudTokenAsync(username)

  // UUID.v4 is modified by sinon
  // it is only installed three returns
  // UUID.v4 has been called once when create a box(boxUUID)
  // so there are only two returns can be used
  // in this loop, UUID.v4 is required
  // but only the first two can get a result, this won't influence the data we need
  for(let i = 0; i < 10; i++) {
    let res = await request(app)
      .post(`/boxes/${boxUUID}/tweets`)
      .set('Authorization', 'JWT ' + cloudToken + ' ' + token)
      .send({comment: 'hello'})
      .expect(200)
  }
}

module.exports = {
  IDS,
  FILES,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserGlobalAsync,
  laCloudTokenAsync,
  waCloudTokenAsync,
  createBoxAsync,
  createBranchAsync,
  forgeRecords
}

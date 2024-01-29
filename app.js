const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let database = null

// ServerDBInitialization
const ServerDBInitialization = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

ServerDBInitialization()

// Login API 1
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await database.get(selectUserQuery)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)

    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'jshvhjsjhdflh')
      response.send({jwtToken: jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// Authenticate with token
const authenticateWithToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'jshvhjsjhdflh', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// ConvertDbObjectToResponseObject
const convertDBObjToResObj = DbObject => {
  return {
    stateId: DbObject.state_id,
    stateName: DbObject.state_name,
    population: DbObject.population,
    districtId: DbObject.district_id,
    districtName: DbObject.district_name,
    cases: DbObject.cases,
    cured: DbObject.cured,
    active: DbObject.active,
    deaths: DbObject.deaths,
  }
}

// API-2
app.get('/states/', authenticateWithToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state`
  const getStatesArray = await database.all(getStatesQuery)
  response.send(
    getStatesArray.map(eachState => convertDBObjToResObj(eachState)),
  )
})

// API-3
app.get(
  '/states/:stateId/',
  authenticateWithToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId}`
    const getState = await database.get(getStateQuery)
    response.send(convertDBObjToResObj(getState))
  },
)

// API-4
app.post('/districts/', authenticateWithToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const addDistrictQuery = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES(
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
    );`
  await database.run(addDistrictQuery)
  response.send('District Successfully Added')
})

// API-5
app.get(
  '/districts/:districtId',
  authenticateWithToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`
    const getDistrict = await database.get(getDistrictQuery)
    response.send(convertDBObjToResObj(getDistrict))
  },
)

// API-6
app.delete(
  '/districts/:districtId/',
  authenticateWithToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`
    await database.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

// API-7
app.put(
  '/districts/:districtId/',
  authenticateWithToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `UPDATE district SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
      WHERE district_id = ${districtId};`
    await database.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

// API-8
app.get(
  '/states/:stateId/stats/',
  authenticateWithToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatsQuery = `
      SELECT
        SUM(cases) as totalCases,
        SUM(cured) as totalCured,
        SUM(active) as totalActive,
        SUM(deaths) as totalDeaths
      FROM district WHERE state_id = ${stateId};`
    const stateStats = await database.get(getStatsQuery)
    response.send(stateStats)
  },
)

// Get Districts
app.get('/districts/', authenticateWithToken, async (request, response) => {
  const getDistrictArray = `SELECT * FROM district`
  const districtArray = await database.all(getDistrictArray)
  response.send(
    districtArray.map(eachDistrict => convertDBObjToResObj(eachDistrict)),
  )
})

module.exports = app

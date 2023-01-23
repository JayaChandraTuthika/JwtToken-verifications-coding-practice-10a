const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3001, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(-1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  console.log(authHeader);
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "Jay", async (error, payload) => {
      console.log("inside verify");
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// //User Register API
// app.post("/users/", authenticateToken, async (request, response) => {
//   const { username, name, password, gender, location } = request.body;
//   const hashedPassword = await bcrypt.hash(request.body.password, 10);
//   const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
//   const dbUser = await db.get(selectUserQuery);
//   if (dbUser === undefined) {
//     const createUserQuery = `
//       INSERT INTO
//         user (username, name, password, gender, location)
//       VALUES
//         (
//           '${username}',
//           '${name}',
//           '${hashedPassword}',
//           '${gender}',
//           '${location}'
//         )`;
//     await db.run(createUserQuery);
//     response.send(`User created successfully`);
//   } else {
//     response.status(400);
//     response.send("User already exists");
//   }
// });

//API 1: LOGIN
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "Jay");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2: GET ALL STATES IN STATE TABLE
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
            SELECT * FROM state ORDER BY state_id;`;
  const dbResponse = await db.all(getAllStatesQuery);
  const statesList = dbResponse.map((state) => {
    return {
      stateId: state.state_id,
      stateName: state.state_name,
      population: state.population,
    };
  });
  response.send(statesList);
});

//API 3: TO GET STATE WITH ID
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
            SELECT * FROM state WHERE state_id = ${stateId};`;

  const dbResponse = await db.get(getStateQuery);
  const state = {
    stateId: dbResponse.state_id,
    stateName: dbResponse.state_name,
    population: dbResponse.population,
  };
  response.send(state);
});

//API 4: CREATE DISTRICT IN DISTRICT TABLE
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistQuery = `
            INSERT INTO district (district_name,state_id,cases,cured,active,deaths) 
            VALUES 
                (
                    '${districtName}',
                    ${stateId},
                    ${cases},
                    ${cured},
                    ${active},
                    ${deaths}
                );`;
  const dbResponse = await db.run(createDistQuery);
  response.send("District Successfully Added");
  console.log(dbResponse.lastID);
});

//API 5: GET DISTRICT BY DISTRICT ID
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistQuery = `
            SELECT 
                *
                FROM
                    district
                WHERE
                    district_id = ${districtId};`;
    const res = await db.get(getDistQuery);
    const dist = {
      districtId: res.district_id,
      districtName: res.district_name,
      stateId: res.state_id,
      cases: res.cases,
      cured: res.cured,
      active: res.active,
      deaths: res.deaths,
    };
    response.send(dist);
  }
);

//APT 6: DELETE DISTRICT BY ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistQuery = `
            DELETE FROM district WHERE district_id = ${districtId};`;
    const dbResponse = await db.run(deleteDistQuery);
    response.send("District Removed");
  }
);

//API 7: UPDATE DISTRICT
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistQuery = `
              UPDATE district
              SET
                  district_name = '${districtName}',
                  state_id = ${stateId},
                  cases = ${cases},
                  cured = ${cured},
                  active = ${active},
                  deaths = ${deaths}
              WHERE
                  district_id = ${districtId};`;
    const dbResponse = await db.run(updateDistQuery);
    response.send("District Details Updated");
  }
);

//API 8: GET STATS FOR STATES
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsOfStateQuery = `
                SELECT 
                    SUM(cases) as totalCases,
                    SUM(cured) as totalCured,
                    SUM(active) as totalActive,
                    SUM(deaths) as totalDeaths 
                FROM district join state on district.state_id = state.state_id 
                GROUP BY district.state_id 
                HAVING district.state_id = ${stateId};`;
    const dbResponse = await db.get(getStatsOfStateQuery);
    response.send(dbResponse);
  }
);

module.exports = app;

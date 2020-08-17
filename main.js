require('dotenv').config()
const v3 = require('node-hue-api').v3;
const { Pool } = require('pg');
const TABLE_NAME = 'temperatures';


const remoteBootstrap = v3.api.createRemote(process.env.CLIENT_ID, process.env.CLIENT_SECRET);
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });


function getAuthCodeUrl(APP_ID, STATE){
    return `${remoteBootstrap.getAuthCodeUrl('node-hue-api-remote', APP_ID, STATE)}`;
}

async function connectAndGetData(TOKEN_ACCESS, TOKEN_REFRESH, TOKEN_USERNAME){
    // Exchange the code for tokens and connect to the Remote Hue API
    try{
        // remoteBootstrap.connectWithCode(authorizationCode)
        const api = await remoteBootstrap.connectWithTokens(
            TOKEN_ACCESS, TOKEN_REFRESH, TOKEN_USERNAME
        );

        console.log('Successfully validated authorization code and exchanged for tokens');

        const remoteCredentials = api.remote.getRemoteAccessCredentials();

        // Display the tokens and username that we now have from using the authorization code. These need to be stored for future use.
        console.log(`The Access Token is valid until:  ${new Date(remoteCredentials.tokens.access.expiresAt)}`);
        console.log(`The Refresh Token is valid until: ${new Date(remoteCredentials.tokens.refresh.expiresAt)}`);
        // console.log('\nNote: You should securely store the tokens and username from above as you can use them to connect\n'+ 'in the future.');

        const sensors = Object.values(await api.sensors.getAll());

        const temperatureSensors = sensors
            .filter((sensor) => sensor.type === "ZLLTemperature")
            .map((sensor) => ({uniqueid: sensor.uniqueid, temperature: sensor.temperature}));

        const namedTemperatureSensors = temperatureSensors
            .map(({uniqueid, temperature}) => {
            sensorName = sensors
                .find((sensor) => 
                    sensor.uniqueid && sensor.type === "ZLLPresence" && sensor.uniqueid.includes(uniqueid.slice(0,-1))
                ).name;
            
                return {uniqueid, temperature, name: sensorName}
            });
        
        const client = await pool.connect();
        const currentDate = new Date();
        const insertQuery = `INSERT INTO ${TABLE_NAME}(date, sensor_name1, temperature1, sensor_name2, temperature2, sensor_name3, temperature3) VALUES ($1, $2, $3, $4, $5, $6, $7)`
        
        await client.query(
            insertQuery,
            [currentDate, ...namedTemperatureSensors.map(({name, temperature}) => [name, temperature]).flat()]
        );
        

        process.exit(0);
    } catch(err){
        console.error('Failed to get a remote connection using token');
        console.error(err);
        process.exit(1);
    }
}

connectAndGetData(
    process.env.TOKEN_ACCESS,
    process.env.TOKEN_REFRESH,
    process.env.TOKEN_USERNAME,
)

const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
require('dotenv').config();
const fileUpload = require('express-fileupload');
const [createTranscribe, createTranscribeJobProcess, getFromDynamoDB, getTranscribeStatus, response] = require('./transcription/transcribeOperation');
const [presignedUrl] = require('./S3Operation/presignedUrl');
app.use(fileUpload());

const port = 3000;
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', "Origin, X-Requested-With, Content-Type, Accept");
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});
// Ping the server
app.get('/', (req, res) => {
  res.send(`Hi, Iam up bro.... Don't worry`);
})
// Get transcribe status
app.get('/getStatus', async (req, res) => {
  try {
    var transcribestatus = await getTranscribeStatus(req.body.uuid);
    if (transcribestatus.TranscriptionJob.TranscriptionJobStatus == "COMPLETED"){
      createTranscribeJobProcess(req.body.uuid);
    }
    res.send(transcribestatus);
  } catch (error) {
    res.send(error);
  }

})
// Get the presigned URI
app.get('/createPresignedUrl', async (req, res) => {
  if (!req.body) res.status(400).send("body is missing");
  if (!req.body.uuid) res.status(400).send("body parameter uuid is missing");
  if (!req.body.filenameExtension) res.status(400).send("body parameter filename extension is missing");
  try {
    presignedUrl(req.body.uuid, req.body.filenameExtension).then((value) => {res.send({"statusCode": 200, "url":value, "msg":"Url is created successfully"})}).catch((err) => {res.send({"statusCode": 400, "msg": err})});
  } catch (error) {
    return error;
  }
})
// When the job is completed then fetch the data
app.get('/getTranscribeData', async (req, res) => {
  const data = req.body;
  if (!data.uuid) res.send("uuid parameter is mising");
  const uuid = data.uuid;
  const GetTranscribeStatus = getTranscribeStatus(uuid).then((value)=>value).catch((e)=>res.send(e));
  const transcription = await getFromDynamoDB(uuid).then((value)=>value).catch((e)=>res.send(e));
  const transcribe = response(transcription);
  res.send(transcribe);
})
// When the upload is complete then createTRanscription has been created
app.post('/createTranscribeJob', async (req, res) => {
  if (!req.body) res.status(400).send("body is missing");
  if (!req.body.uuid) res.status(400).send("body parameter uuid is missing");
  if (!req.body.filenameExtension) res.status(400).send("body parameter filenameExtension is missing");
  const body = req.body;
  const uuid = req.body.uuid;
  const filenameExtension = req.body.filenameExtension;
  const mediaFileUri = `s3://transcriberappdata/${uuid}.${filenameExtension}`;
  createTranscribe(uuid, mediaFileUri, filenameExtension).then((e) => res.send(e)).catch((e) => res.send(e));
});
// Saving Data to Database
app.post('/createData', async (req, res) => {
  if (!req.body) res.status(400).send("body is missing");
  if (!req.body.uuid) res.status(400).send("body parameter uuid is missing");
  const uuid = req.body.uuid;
  createTranscribeJobProcess(uuid);
  res.send({"statusCode": 200, "msg": "data has been creted successfully" });
})
// Frontend testing 
app.put('/pushDataToS3', async (req, res) =>{
  if (!req.body) res.status(400).send("body is missing");
  if (!req.body.uri) res.status(400).send("body parameter uri is missing");
  const body = req.body;
  const uri = req.body.uri;
  const file = req.files.audio_file;
  try {
    const response = await fetch(uri, {
      method: 'PUT',
      headers: {'Content-Type':'audio/mpeg'},
      body: file.data
    });
  res.send({"statusCode": 200, "msg":"Upload is successfully done"});  
  } catch (error) {
    res.send(error);
  }
})
app.listen(port, () => {
  console.log(`server is at ${port} 🔥`);
})

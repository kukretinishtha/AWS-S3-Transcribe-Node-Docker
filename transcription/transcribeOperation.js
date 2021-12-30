// initialize aws-sdk for node
const AWS = require('aws-sdk');
const res = require('express/lib/response');
const fetch = require('node-fetch');
const ACCESS_KEY_ID = process.env.AWS_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET;
AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY
});
const transcribeService = new AWS.TranscribeService();
var docClient = new AWS.DynamoDB.DocumentClient();
// TODO: Logger File Creation
// TODO: Dynamo DB File Seperation
/**
 * 
Step1: upload audio file to s3.

Step2: create a transribe job.

Step3: get the status of the job.

Step4: after the completion of job.
 */

const createTranscribe = (new_uuid, MediaFileUri, filenameExtension) => {
    let transcribeFilename = `${new_uuid}`;
    const params = {
        TranscriptionJobName: transcribeFilename,
        Media: { MediaFileUri },
        MediaFormat: filenameExtension,
        IdentifyLanguage: true,
        LanguageOptions: ['en-IN', 'hi-IN', 'ta-IN'],
        Settings: {
            'MaxSpeakerLabels': 10,
            'ShowSpeakerLabels': true,
            'ShowAlternatives': true,
            "MaxAlternatives": 2
        }
    }
    return new Promise((resolve, reject) => {
        transcribeService.startTranscriptionJob(params, function (err, data) {
            if (err) {
                reject(err);
            } 
            else {
                resolve(data);
            }
        })
    })
};

const createTranscribeJobProcess = function (filename) {
    var params = {
        TranscriptionJobName: filename /* required */
    };   
    transcribeService.getTranscriptionJob(params, function (err, data) {
        if (err) {
            return err;
        }
        else {
            if (data.TranscriptionJob.TranscriptionJobStatus == 'COMPLETED') {
                let transcriptFileUri = data.TranscriptionJob.Transcript.TranscriptFileUri;
                fetchTranscribeDataFromS3(transcriptFileUri).then((data) => {
                    var transcribeData = getTranscribeData(data);
                    saveTodynamo(filename, { data: transcribeData });
                    return transcribeData;
                })
            } else {
                return data.TranscriptionJob.TranscriptionJobStatus;
            } 
        }
    });
}
const fetchTranscribeDataFromS3 = async function (url) {
    // Storing response after Transcription to S3
    const response = await fetch(url);
    return response.json();
}
const getTranscribeData = (asrData) => {
    uuid = asrData.jobName;
    seg = asrData.results.speaker_labels.segments;
    lengthofSeg = seg.length;
    transcribedSegments = asrData.results.segments;
    transcriptData = [];
    for(let i =0; i<lengthofSeg; i++){
        startTime = asrData.results.speaker_labels.segments[i].start_time;
        endTime = asrData.results.speaker_labels.segments[i].end_time;
        speakerLabel = asrData.results.speaker_labels.segments[i].speaker_label;
        transcript = asrData.results.segments[i].alternatives[0]["transcript"];
        transcriptData.push({"startTime" : startTime, "endTime": endTime, "speakerLabel":speakerLabel, "transcript":transcript});
    }
    return transcriptData;
}
const saveTodynamo = (uuid, data) => {
    const table = "transcriptions";
    var params = {
        TableName: table,
        Item: {
            UUID: uuid,
            data: data
        }
    }
    return new Promise((resolve, reject) => {
        docClient.put(params, function (err, value) {
            if (err) {
                reject(err);
            } else {
                resolve(value);
            }
        })
    })
}
const getFromDynamoDB = (uuid) => {
    var params = {
        TableName: process.env.TRANSCRIBE_TABLE_NAME,
        Key: { "UUID": uuid }
    };
    return new Promise((resolve, reject) => {
        docClient.get(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        })
    });
}
const getTranscribeStatus = function (filename) {
    var params = {
        TranscriptionJobName: filename /* required */
    };
    return new Promise((resolve, reject) => {
        TranscribeJobStatus = transcribeService.getTranscriptionJob(params, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        })
    })
}

const response = (data) => {
    console.log("data", data);
    var transcribeJobName = data.Item.UUID;
    var transcripts = data.Item.data.data;
    return ({"transcribeJobName": transcribeJobName, "transcripts": transcripts, "statusCode": 200});
}

module.exports = [createTranscribe, createTranscribeJobProcess, getFromDynamoDB, getTranscribeStatus, response];
import * as allDataObjects from '../../../services/data-model-objects';
import fs from 'fs';
import path from 'path';
const FormData = require('form-data');
import { createReadStream, createWriteStream } from 'fs';
import { getContentTypeFromFileName } from '../../../utils/arx-chat-agent-utils';
import { AttachmentProcessingService } from '../../../services/candidate-engagement/attachment-processing';
import CandidateEngagementArx from '../../../services/candidate-engagement/check-candidate-engagement';
const axios = require('axios');
import { getTranscriptionFromWhisper } from '../../../utils/arx-chat-agent-utils';
import {WhatsappTemplateMessages} from './template-messages';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../candidate-engagement/update-chat';
const { exec } = require('child_process');

let whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_PERMANENT_API;

if (process.env.FACEBOOK_WHATSAPP_PERMANENT_API) {
  whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_PERMANENT_API;
} else {
  whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_API_TOKEN;
}

const templates = ['hello_world', 'recruitment','application','application02', 'application03'];
export class FacebookWhatsappChatApi {
  async uploadAndSendFileToWhatsApp(attachmentMessage: allDataObjects.AttachmentMessageObject) {
    console.log('Send file');
    console.log('sendFileObj::y::', attachmentMessage);
    const filePath = attachmentMessage?.fileData?.filePath;
    const phoneNumberTo = attachmentMessage?.phoneNumberTo;
    const attachmentText = 'Sharing the JD';
    const response = await new FacebookWhatsappChatApi().uploadFileToWhatsApp(attachmentMessage);
    const mediaID = response?.mediaID;
    const fileName = attachmentMessage?.fileData?.fileName;
    const sendTextMessageObj = {
      phoneNumberFrom: '918411937769',
      attachmentText: attachmentText,
      phoneNumberTo: phoneNumberTo ?? '918411937769',
      mediaFileName: fileName ?? 'AttachmentFile',
      mediaID: mediaID,
    };
    const personObj = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(phoneNumberTo);
    const mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    mostRecentMessageArr.push({ role: 'user', content: 'Sharing the JD' });
    new FacebookWhatsappChatApi().sendWhatsappAttachmentMessage(sendTextMessageObj, personObj, mostRecentMessageArr);
  }
  

  async sendWhatsappTextMessage(sendTextMessageObj: allDataObjects.ChatRequestBody) {
    console.log('Sending a message to ::', sendTextMessageObj.phoneNumberTo.replace("+",""));
    console.log('Sending message text ::', sendTextMessageObj.messages);
    const text_message = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: sendTextMessageObj.phoneNumberTo.replace("+",""),
      type: 'text',
      text: { preview_url: false, body: sendTextMessageObj.messages },
    };
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://graph.facebook.com/v18.0/' + process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID + '/messages',
      headers: {
        Authorization: 'Bearer ' + whatsappAPIToken,
        'Content-Type': 'application/json',
      },
      data: text_message,
    };
    // console.log("This is the config in sendWhatsappTextMessage:", config)

    const response = await axios.request(config);
    console.log("Status on sending that whatsaapp message::", response?.status)

    return response;
  }

  async fetchFileFromTwentyGetLocalPath() {
    const fileUrl =
      process.env.SERVER_BASE_URL+'/files/attachment/2604e253-36e3-4e87-9638-bdbb661a0547.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmF0aW9uX2RhdGUiOiIyMDI0LTA1LTI3VDEwOjE3OjM5Ljk2MFoiLCJhdHRhY2htZW50X2lkIjoiZjIwYjE5YzUtZDAwYy00NzBjLWI5YjAtNzY2MTgwOTdhZjkyIiwiaWF0IjoxNzE2NzE4NjU5LCJleHAiOjE3MTY4OTg2NTl9.NP6CvbDKTh3W0T0uP0JKUfnV_PmN6rIz6FanK7Hp_us';
    const response = await axios.get(fileUrl, { responseType: 'stream' });
    console.log('Response status received:', response.status);
    console.log('Response.data:', response.data);
    // console.log("Response.data stringified:", JSON.stringify(response))

    const fileName = response.headers['content-disposition']?.split('filename=')[1]?.trim().replace(/"/g, '') ?? 'file.pdf';
    console.log('FileName:', fileName);

    const currentDir = process.cwd();
    const filePath = path.resolve(currentDir, fileName);
    console.log('This is the file path:', filePath);

    const writeStream = createWriteStream(filePath);
    response.data.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    console.log("response.headers['']:", response.headers);
    console.log("response.headers['content-type']:", response.headers['content-type']);

    const contentType = response.headers['content-type'] || 'application/pdf';
    return { filePath, fileName, contentType };
  }

  async uploadFileToWhatsApp(attachmentMessage: allDataObjects.AttachmentMessageObject) {
    console.log('This is the upload file to whatsapp in arx chat');

    try {
      // const filePath = '/Users/arnavsaxena/Downloads/CVs-Mx/Prabhakar_Azad_Resume_05122022.doc';
      // Get the file name
      const filePath = attachmentMessage?.fileData?.filePath.slice();

      const fileName = path.basename(filePath);
      const contentType = await getContentTypeFromFileName(fileName);
      console.log('This is the content type:', contentType);
      console.log('This is the file name:', fileName);

      const fileData = createReadStream(filePath);

      const formData = new FormData();
      formData.append('file', fileData, {
        contentType: contentType,
        filename: fileName,
      });

      formData.append('messaging_product', 'whatsapp');
      let response;
      try {
        let response;
        response = await axios.post(process.env.SERVER_BASE_URL+'/whatsapp-controller/uploadFile', { filePath: filePath });
        if (!response?.data?.mediaID) {
          console.error('Failed to upload JD to WhatsApp. Retrying it again...');
          response = await axios.post(process.env.SERVER_BASE_URL+'/whatsapp-controller/uploadFile', { filePath: filePath });
          if (!response?.data?.mediaID) {
            console.error('Failed to upload JD to WhatsApp the second time. Bad luck! :(');
            const phoneNumberTo = attachmentMessage?.phoneNumberTo;
            const personObj = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(phoneNumberTo);
            const mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
            mostRecentMessageArr.push({ role: 'user', content: 'Failed to send JD to the candidate.' });
            const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj( 'failed', personObj, mostRecentMessageArr, );
            await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
          }
        }
        console.log('media ID', response?.data?.mediaID);
        console.log('Request successful');

        console.log('****Response data********????:', response.data);
        console.log('media ID', response?.data?.mediaID);
        console.log('Request successful');
        return {
          mediaID: response?.data?.mediaID,
          status: 'success',
          fileName: fileName,
          contentType: contentType,
        };
      } catch (err) {
        debugger;
        console.error('Errir heree', response?.data);
        console.error('upload', err.toJSON());
        console.log(err.data);

        // Remove the local file
        // const unlink = promisify(fs.unlink);
        // await unlink(filePath);
      }
    } catch (error) {
      console.error('Error downloading file from WhatsApp:', error);
      throw error;
    }
    // Get the file name and content type from the response headers
  }

  async uploadFileToWhatsAppUsingControllerApi(filePathArg: string) {
    console.log('This is the upload file to whatsapp in recruitment agent');
    // debugger;
    try {
      const filePath = filePathArg.slice();
      const fileName = path.basename(filePath);
      const contentType = await getContentTypeFromFileName(fileName);
      console.log('This is the content type:', contentType);
      console.log('This is the file name:', fileName);

      const formData = new FormData();
      formData.append('file', createReadStream(filePath), {
        contentType: contentType,
        filename: fileName,
      });

      formData.append('messaging_product', 'whatsapp');
      try {
        const {
          data: { id: mediaId },
        } = await axios.post(`https://graph.facebook.com/v18.0/${process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID}/media`, formData, {
          headers: {
            Authorization: `Bearer ${whatsappAPIToken}`,
            ...formData.getHeaders(),
          },
        });
        console.log('media ID', mediaId);
        console.log('Request successful');
        return {
          mediaID: mediaId,
          status: 'success',
          fileName: fileName,
          contentType: contentType,
        };
      } catch (err) {
        console.error('upload', err.toJSON());
      }
      // Remove the local file
      // const unlink = promisify(fs.unlink);
      // await unlink(filePath);
    } catch (error) {
      console.error('Error downloading file from WhatsApp:', error);
      throw error;
    }
  }

  async sendWhatsappAttachmentMessage(sendWhatsappAttachmentTextMessageObj: allDataObjects.FacebookWhatsappAttachmentChatRequestBody, personObj: allDataObjects.PersonNode, mostRecentMessageArr: allDataObjects.ChatHistoryItem[]) {
    console.log('sending whatsapp attachment message');
    const text_message = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: sendWhatsappAttachmentTextMessageObj.phoneNumberTo,
      type: 'document',
      document: {
        id: sendWhatsappAttachmentTextMessageObj.mediaID,
        caption: sendWhatsappAttachmentTextMessageObj.attachmentText,
        filename: sendWhatsappAttachmentTextMessageObj.mediaFileName ? sendWhatsappAttachmentTextMessageObj.mediaFileName : 'attachment',
      },
    };

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://graph.facebook.com/v18.0/' + process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID + '/messages',
      headers: {
        Authorization: 'Bearer ' + whatsappAPIToken,
        'Content-Type': 'application/json',
      },
      data: text_message,
    };
    //   console.log("This is the config in sendWhatsappAttachmentMessage:", config)

    try {
      const response = await axios.request(config);
      console.log('This is response data after sendAttachment is called', JSON.stringify(response.data));
      const wamId = response?.data?.messages[0]?.id;
      const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj(
        wamId,
        // response,
        personObj,
        mostRecentMessageArr,
      );
      await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    } catch (error) {
      console.log(error);
    }
  }

  async sendWhatsappTemplateMessage(sendTemplateMessageObj: allDataObjects.sendWhatsappTemplateMessageObjectType) {
    console.log('Received this template message object:', sendTemplateMessageObj);
    let templateMessage = new WhatsappTemplateMessages().getTemplateMessageObj(sendTemplateMessageObj);
    console.log('This is the template message object:', templateMessage);
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://graph.facebook.com/v18.0/' + process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID + '/messages',
      headers: {
        Authorization: 'Bearer ' + whatsappAPIToken,
        'Content-Type': 'application/json',
      },
      data: templateMessage,
    };
    // console.log("This is the config in sendWhatsappTemplateMessage:", config);
    try {
      const response = await axios.request(config);
      // console.log("This is the response:", response)
      // console.log("This is the response data:", response.data)
      if (response?.data?.messages[0]?.message_status === 'accepted') {
        console.log('Message sent successfully and accepted by FACEBOOK API with id::', response?.data?.messages[0]?.id);
        return response?.data;
        // wamid.HBgMOTE4NDExOTM3NzY5FQIAERgSNjI0NkM1RjlCNzBGMEE5MjY5AA
      }
      console.log('This is the message sent successfully');
    } catch (error) {
      console.log('This is error in facebook graph api when sending messaging template::', error);
    }
  }
  async sendWhatsappUtilityMessage(sendUtilityMessageObj: allDataObjects.sendWhatsappUtilityMessageObjectType) {
    console.log('Received this utiltuy message object:', sendUtilityMessageObj);
    let utilityMessage = new WhatsappTemplateMessages().getUpdatedUtilityMessageObj(sendUtilityMessageObj);
    console.log('This is the utlity message object:', utilityMessage);
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://graph.facebook.com/v18.0/' + process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID + '/messages',
      headers: {
        Authorization: 'Bearer ' + whatsappAPIToken,
        'Content-Type': 'application/json',
      },
      data: utilityMessage,
    };
    // console.log("This is the config in sendWhatsappTemplateMessage:", config);
    try {
      const response = await axios.request(config);
      // console.log("This is the response:", response)
      // console.log("This is the response data:", response.data)
      if (response?.data?.messages[0]?.message_status === 'accepted') {
        console.log('Message sent successfully and accepted by FACEBOOK API with id::', response?.data?.messages[0]?.id);
        return response?.data;
        // wamid.HBgMOTE4NDExOTM3NzY5FQIAERgSNjI0NkM1RjlCNzBGMEE5MjY5AA
      }
      console.log('This is the message sent successfully');
    } catch (error) {
      console.log('This is error in facebook graph api when sending messaging template::', error);
    }
  }

  async downloadWhatsappAttachmentMessage(
    sendTemplateMessageObj: {
      filename: string;
      mime_type: string;
      documentId: string;
    },
    candidateProfileData: allDataObjects.CandidateNode,
  ) {
    const constCandidateProfileData = candidateProfileData;
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: 'https://graph.facebook.com/v18.0/' + sendTemplateMessageObj.documentId,
      headers: {
        Authorization: 'Bearer ' + whatsappAPIToken,
        'Content-Type': 'application/json',
      },
      responseType: 'json',
    };
    const response = await axios.request(config);
    const url = response.data.url;
    config.url = url;
    config.responseType = 'stream';
    const fileDownloadResponse = await axios.request(config);
    console.log('This is the response: body in the download Attachment', response.body);
    const fileName = sendTemplateMessageObj.filename; // Set the desired file name
    const filePath = `${process.cwd()}/${fileName}`;
    const writeStream = fs.createWriteStream(filePath);
    fileDownloadResponse.data.pipe(writeStream); // Pipe response stream to file stream
    writeStream.on('finish', async () => {
      console.log('File saved successfully at', filePath);
      const attachmentObj = await new AttachmentProcessingService().uploadAttachmentToTwenty(filePath);
      console.log(attachmentObj);
      const dataToUploadInAttachmentTable = {
        input: {
          authorId: candidateProfileData.jobs.recruiterId,
          name: filePath.replace(`${process.cwd()}/`, ''),
          fullPath: attachmentObj?.data?.uploadFile,
          type: 'TextDocument',
          candidateId: constCandidateProfileData.id,
        },
      };
      await new AttachmentProcessingService().createOneAttachmentFromFilePath(dataToUploadInAttachmentTable);
    });
    writeStream.on('error', error => {
      console.error('Error saving file:', error);
    });
  }
  async sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj: allDataObjects.candidateChatMessageType, personNode: allDataObjects.PersonNode, mostRecentMessageArr: allDataObjects.ChatHistoryItem[], chatControl:string) {
    console.log('Sending message to whatsapp via facebook api');
    console.log('whatappUpdateMessageObj.messageType', whatappUpdateMessageObj.messageType);
    console.log('whatappUpdateMessageObj.messageType chat controles', chatControl);
    // console.log('whatappUpdateMessageObj.messageType whatappUpdateMessageObj.messages ', JSON.stringify(whatappUpdateMessageObj));
    let response;
    if (whatappUpdateMessageObj.messages[0].content.includes('#DONTRESPOND#') || whatappUpdateMessageObj.messages[0].content.includes('DONTRESPOND') || whatappUpdateMessageObj.messages[0].content.includes('DONOTRESPOND')) {
      console.log('Found a #DONTRESPOND# message in STAGE 2, so not sending any message');
      return;
    }
    if (whatappUpdateMessageObj.messageType === 'botMessage') {
      console.log('TEmplate Message or Text Message depends on :', whatappUpdateMessageObj.messages[0].content);
      let whatappUpdateMessageObjAfterWAMidUpdate:allDataObjects.candidateChatMessageType;
      if (whatappUpdateMessageObj.messages[0].content.includes('Based Recruitment Company') || whatappUpdateMessageObj.messages[0].content.includes('assist')) {
        console.log('This is the template api message to send in whatappUpdateMessageObj.phoneNumberFrom, ', whatappUpdateMessageObj.phoneNumberFrom);
        let messageTempalate:string
        if (chatControl === 'startChat') {
          messageTempalate = 'application03'
        } else {
          messageTempalate = whatappUpdateMessageObj?.whatsappMessageType || 'application03';
        }
        const sendTemplateMessageObj:allDataObjects.sendWhatsappUtilityMessageObjectType = {
          recipient: whatappUpdateMessageObj.phoneNumberTo.replace('+', ''),
          template_name: messageTempalate,
          candidateFirstName: whatappUpdateMessageObj.candidateFirstName,
          recruiterName: allDataObjects.recruiterProfile.name,
          recruiterJobTitle: allDataObjects.recruiterProfile.job_title,
          recruiterCompanyName: allDataObjects.recruiterProfile.job_company_name,
          recruiterCompanyDescription: allDataObjects.recruiterProfile.company_description_oneliner,
          jobPositionName: whatappUpdateMessageObj?.candidateProfile?.jobs?.name,
          companyName: whatappUpdateMessageObj?.candidateProfile?.jobs?.companies?.name,
          descriptionOneliner:whatappUpdateMessageObj?.candidateProfile?.jobs?.companies?.descriptionOneliner,
          jobCode: whatappUpdateMessageObj?.candidateProfile?.jobs?.jobCode,
          jobLocation: whatappUpdateMessageObj?.candidateProfile?.jobs?.jobLocation,
        };
        response = await this.sendWhatsappUtilityMessage(sendTemplateMessageObj);
      } else {
        console.log('This is the standard message to send fromL', allDataObjects.recruiterProfile.phone);
        console.log('This is the standard message to send to phone:', whatappUpdateMessageObj.phoneNumberTo);
        const sendTextMessageObj: allDataObjects.ChatRequestBody = {
          phoneNumberFrom: allDataObjects.recruiterProfile.phone,
          phoneNumberTo: whatappUpdateMessageObj.phoneNumberTo,
          messages: whatappUpdateMessageObj.messages[0].content,
        };
        response = await this.sendWhatsappTextMessage(sendTextMessageObj);
        // whatappUpdateMessageObjAfterWAMidUpdate = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj( response?.data?.messages[0]?.id || response.messages[0].id, personNode, mostRecentMessageArr, );
      }
      whatappUpdateMessageObjAfterWAMidUpdate = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj(response?.data?.messages[0]?.id || response.messages[0].id, personNode, mostRecentMessageArr);
      await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObjAfterWAMidUpdate);

    } else {
      console.log('passing a human message so, going to trash it');
    }
  }
  async handleAudioMessage(audioMessageObject: { filename: string; mime_type: string; audioId: string }, candidateProfileData: allDataObjects.CandidateNode) {
    let audioTranscriptionText;
    const constCandidateProfileData = candidateProfileData;
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: 'https://graph.facebook.com/v18.0/' + audioMessageObject?.audioId,
      headers: {
        Authorization: 'Bearer ' + whatsappAPIToken,
        'Content-Type': 'application/json',
      },
      responseType: 'json',
    };

    await fs.promises.mkdir(process.cwd() + '/.voice-messages/' + candidateProfileData?.id, { recursive: true });
    const filePath = `${process.cwd()}/.voice-messages/${candidateProfileData?.id}/${audioMessageObject?.filename}`;
    let uploadFilePath = '';

    try {
      const response = await axios.request(config);
      const url = response.data.url;
      let fileSaved = false;

      await new Promise<void>((resolve, reject) => {
        exec(`curl --location '${url}' --header 'Authorization: Bearer ${whatsappAPIToken}' --output ${filePath}`, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error executing curl: ${error}`);
            reject(error);
          } else {
            console.log('Curl output:', stdout);
            fileSaved = true;
            resolve();
          }
        });
      });

      if (fileSaved) {
        console.log('File saved successfully at', filePath);
        try {
          // Check if file exists before uploading
          await fs.access(filePath, err => {
            console.log(err);
          });
          const attachmentObj = await new AttachmentProcessingService().uploadAttachmentToTwenty(filePath);
          // console.log(attachmentObj);
          uploadFilePath = attachmentObj?.data?.uploadFile;
        } catch (uploadError) {
          console.error('Error during file upload:', uploadError);
        }
      } else {
        console.error('File was not saved.');
      }
    } catch (axiosError) {
      console.error('Error with axios request:', axiosError);
    }
    audioTranscriptionText = await getTranscriptionFromWhisper(filePath);
    console.log(`DONEE`);
    console.log('Uploaded here', uploadFilePath);
    return {
      databaseFilePath: uploadFilePath,
      audioTranscriptionText: audioTranscriptionText,
    };
  }
}
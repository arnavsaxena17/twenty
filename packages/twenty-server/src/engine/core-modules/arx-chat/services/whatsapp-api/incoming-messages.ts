import { FacebookWhatsappChatApi } from '../../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import CandidateEngagementArx from '../../services/candidate-engagement/check-candidate-engagement';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../services/candidate-engagement/update-chat';
import * as allDataObjects from '../../services/data-model-objects';
import * as allGraphQLQueries from '../../services/candidate-engagement/graphql-queries-chatbot';
import { axiosRequest } from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';

export class IncomingWhatsappMessages {
  async receiveIncomingMessagesFromBaileys(requestBody: allDataObjects.BaileysIncomingMessage) {
    // console.log('This is requestBody::', requestBody);
    let savedMessage
    if (requestBody.message == ""){
      savedMessage = "Attachment Received"
    }
    else{
      savedMessage = requestBody.message
    }
    console.log("Saved message is ::", savedMessage)

    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
      phoneNumberFrom: requestBody.phoneNumberFrom,
      phoneNumberTo: requestBody.phoneNumberTo,
      messages: [{ role: 'user', content: savedMessage }],
      messageType: 'string',
    };
    const chatReply = savedMessage;
    const status = '';
    console.log('We will first go and get the candiate who sent us the message');
    const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatsappIncomingMessage);
    console.log('This is the candiate who has sent us the message fromBaileys., we have to update the database that this message has been recemivged::', chatReply);
    if (candidateProfileData != allDataObjects.emptyCandidateProfileObj) {
      // console.log('This is the candiate who has sent us candidateProfileData::', candidateProfileData);
      await this.createAndUpdateIncomingCandidateChatMessage({ chatReply: savedMessage, whatsappDeliveryStatus: 'delivered', whatsappMessageId: requestBody.baileysMessageId }, candidateProfileData);
    } else {
      console.log('Message has been received from a candidate however the candidate is not in the database');
    }
  }
  async receiveIncomingMessagesFromSelfFromBaileys(requestBody: allDataObjects.BaileysIncomingMessage) {
    // console.log('This is requestBody::', requestBody);
    console.log('-------This is the self message-------------');
    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
      phoneNumberFrom: requestBody.phoneNumberFrom,
      phoneNumberTo: requestBody.phoneNumberTo,
      messages: [{ role: 'assistant', content: requestBody.message }],
      messageType: 'messageFromSelf',
    };
    const chatReply = requestBody.message;
    console.log('We will first go and get the candiate who sent us the message');
    const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatsappIncomingMessage);
    console.log('This is the SELF message., we have to update the database that this message has been received::', chatReply);
    if (candidateProfileData != allDataObjects.emptyCandidateProfileObj) {
      // console.log('This is the candiate who has sent us candidateProfileData::', candidateProfileData);
      await this.createAndUpdateIncomingCandidateChatMessage({ chatReply: chatReply, whatsappDeliveryStatus: 'delivered', whatsappMessageId: requestBody.baileysMessageId, isFromMe: true }, candidateProfileData);
      // const replyObject = { chatReply: chatReply, whatsappDeliveryStatus: 'receivedFromHumanBot', whatsappMessageId: requestBody?.baileysMessageId };
      // await this.createAndUpdateIncomingCandidateChatMessage(replyObject, candidateProfileData);
      new FetchAndUpdateCandidatesChatsWhatsapps().setCandidateEngagementStatusToFalse(candidateProfileData);
    } else {
      console.log('Message has been received from a candidate however the candidate is not in the database');
    }
  }

  isWithinLast5Minutes(unixTimestamp) {
    let currentTime = Math.floor(Date.now() / 1000); 
    let providedTime = parseInt(unixTimestamp, 10);
    let differenceInSeconds = currentTime - providedTime;
    return differenceInSeconds < 300;
  }

  async fetchWhatsappMessageById(messageId: string) {
    console.log('This is the message id:', messageId);
    try {
      const whatsappMessageVariable = {
        whatsappMessageId: messageId,
      };
      const response = await axiosRequest(
        JSON.stringify({
          query: allGraphQLQueries.graphqlToFetchOneWhatsappMessageByWhatsappId,
          variables: whatsappMessageVariable,
        }),
      );
      console.log('Response from fetchWhatsappMessageById:', response?.data);
      return response?.data;
    } catch (error) {
      console.log('Error fetching whatsapp message by id:', error);
      return { error: error };
    }
  }
  async receiveIncomingMessagesFromFacebook(requestBody: allDataObjects.WhatsAppBusinessAccount) {
    console.log('This is requestBody from Facebook::', JSON.stringify(requestBody));
    // to check if the incoming message is the status of the message

    if (requestBody?.entry[0]?.changes[0]?.value?.statuses && requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status && !requestBody?.entry[0]?.changes[0]?.value?.messages) {
      const messageId = requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.id;
      const messageStatus = requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status;

      const variables = { filter: { whatsappMessageId: { ilike: `%${messageId}%` } }, orderBy: { position: 'AscNullsFirst' } };
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindMessageByWAMId, variables: variables });
      const response = await axiosRequest(graphqlQueryObj);
      console.log('-----------------This is the response from the query to find the message by WAMID::-------------------');
      // debugger
      // console.log("Response to query on who sent the messages::", response?.data?.data);

      if (response?.data?.data?.whatsappMessages?.edges.length === 0) {
        console.log('No message found with the given WAMID');
        return;
      }

      if (response?.data?.data?.whatsappMessages?.edges[0]?.node?.whatsappDeliveryStatus === 'read' || (response?.data?.data?.whatsappMessages?.edges[0]?.node?.whatsappDeliveryStatus === 'delivered' && messageStatus !== 'read')) {
        console.log('Message has already been read/delivered, skipping the update');
        return;
      }
      const variablesToUpdateDeliveryStatus = { idToUpdate: response?.data?.data?.whatsappMessages?.edges[0]?.node?.id, input: { whatsappDeliveryStatus: messageStatus } };
      // debugger
      const graphqlQueryObjForUpdationForDeliveryStatus = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateMessageDeliveryStatus, variables: variablesToUpdateDeliveryStatus });
      const responseOfDeliveryStatus = await axiosRequest(graphqlQueryObjForUpdationForDeliveryStatus);

      console.log('---------------DELIVERY STATUS UPDATE DONE-----------------------');
      // console.log(responseOfDeliveryStatus);
    } else if (requestBody?.entry[0]?.changes[0]?.value?.messages?.length > 0) {
      // to check if the incoming message is the message
      console.log('There is a request body for sure', requestBody?.entry[0]?.changes[0]?.value?.messages[0]);
      const userMessageBody = requestBody?.entry[0]?.changes[0]?.value?.messages[0];
      // console.log("This is the user messageBody :", userMessageBody)
      if (userMessageBody) {
        let timestamp = requestBody?.entry[0]?.changes[0]?.value?.messages[0].timestamp; // Assuming this is the Unix timestamp in seconds
        let result = this.isWithinLast5Minutes(timestamp);
        if (!result) {
          console.log('MESSAGE IS NOT WITHIN 5 MINUTES:::: ', userMessageBody);
          return;
        }

        // console.log('There is a usermessage body in the request', userMessageBody);
        if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== 'utility' && requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== 'document' && requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== 'audio') {
          // debugger
          console.log('We have a whatsapp incoming message which is a text one we have to do set of things with which is not a utility message');
          let chatReply = userMessageBody?.text?.body;
          if (!chatReply && userMessageBody.reaction.id){
          const whatsappMessageCommentedOn = await this.fetchWhatsappMessageById(userMessageBody?.reaction?.id);

            console.log("its likely an emoji message or emoji reaction to precededing message")
            console.log("Emoji message:", userMessageBody.reaction.emoji, "to message id:", userMessageBody.reaction.id, "from ::", userMessageBody.reaction.from)
            // Adhoc setting chatReply to emoji. lets see how it goes.
            const messageToAppend = 'Reacted ' + userMessageBody.reaction.emoji + ' to ' + "'" + whatsappMessageCommentedOn + "'" || '';
            chatReply = messageToAppend
          }
          const phoneNumberTo = requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number;
          const whatsappIncomingMessage: allDataObjects.chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{ role: 'user', content: chatReply }],
            messageType: 'string',
          };
          console.log('We will first go and get the candiate who sent us the message');
          const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatsappIncomingMessage);
          console.log('This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::', chatReply);
          // console.log('This is the candiate who has sent us candidateProfileData::', candidateProfileData);
          const replyObject = {
            chatReply: chatReply,
            whatsappDeliveryStatus: 'receivedFromCandidate',
            whatsappMessageId: requestBody?.entry[0]?.changes[0]?.value?.messages[0].id,
          };

          const responseAfterMessageUpdate = await this.createAndUpdateIncomingCandidateChatMessage(replyObject, candidateProfileData);
          if (candidateProfileData?.candidateReminders?.edges.length > 0) {
            const listOfReminders = candidateProfileData?.candidateReminders?.edges;
            const updateOneReminderVariables = { idToUpdate: listOfReminders[0]?.node?.id, input: { isReminderActive: false } };
            const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToCreateOneNewWhatsappMessage, variables: updateOneReminderVariables });
            console.log('This is the graphqlQueryObj after updating the reminder status::', graphqlQueryObj);
          }

          console.log(responseAfterMessageUpdate);
        } else if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type === 'document') {
          const sendTemplateMessageObj = {
            documentId: requestBody?.entry[0]?.changes[0]?.value?.messages[0].document.id,
            filename: requestBody?.entry[0]?.changes[0]?.value?.messages[0].document.filename,
            mime_type: requestBody?.entry[0]?.changes[0]?.value?.messages[0].document.mime_type,
          };
          const phoneNumberTo = requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number;

          const whatsappIncomingMessage: allDataObjects.chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{ role: 'user', content: '' }],
            messageType: 'string',
          };

          const replyObject = { chatReply: userMessageBody?.text?.body || 'Attachment Received', whatsappDeliveryStatus: 'receivedFromCandidate', whatsappMessageId: requestBody?.entry[0]?.changes[0]?.value?.messages[0].id };
          const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatsappIncomingMessage);
          await new FacebookWhatsappChatApi().downloadWhatsappAttachmentMessage(sendTemplateMessageObj, candidateProfileData);
          await this.createAndUpdateIncomingCandidateChatMessage(replyObject, candidateProfileData);
        }
        // Audio message
        else if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type === 'audio') {
          const audioMessageObject = {
            audioId: requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.audio?.id,
            filename: requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.audio?.id + '.ogg',
            mime_type: requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.audio?.mime_type,
          };
          const phoneNumberTo = requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number;

          const whatsappIncomingMessage: allDataObjects.chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{ role: 'user', content: '' }],
            messageType: 'string',
          };

          const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatsappIncomingMessage);
          const audioMessageDetails = await new FacebookWhatsappChatApi().handleAudioMessage(audioMessageObject, candidateProfileData);

          console.log('This is the audioMessageDetails::', audioMessageDetails);
          // debugger;
          const replyObject = {
            chatReply: audioMessageDetails?.audioTranscriptionText || 'Audio Message Received',
            whatsappDeliveryStatus: 'receivedFromCandidate',
            type: 'audio',
            databaseFilePath: audioMessageDetails?.databaseFilePath,
            whatsappMessageId: requestBody?.entry[0]?.changes[0]?.value?.messages[0].id,
          };

          await this.createAndUpdateIncomingCandidateChatMessage(replyObject, candidateProfileData);
        }
      }
    } else {
      console.log('Message of type:', requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status, ', ignoring it');
    }
  }
  async createAndUpdateIncomingCandidateChatMessage(
    replyObject: { whatsappDeliveryStatus: string; chatReply: string; whatsappMessageId: string; databaseFilePath?: string | null; type?: string; isFromMe?: boolean },
    candidateProfileDataNodeObj: allDataObjects.CandidateNode,
  ) {
    const recruiterProfile = allDataObjects.recruiterProfile;
    const messagesList = candidateProfileDataNodeObj?.whatsappMessages?.edges;
    // Ensure messagesList is not undefined before sorting
    // console.log( 'This is the messageObj:', messagesList.map((edge: any) => edge.node.messageObj), );
    console.log('This is the chat reply in createAndUpdateIncomingCandidateChatMessage:', replyObject.chatReply);
    let mostRecentMessageObj;
    if (messagesList) {
      // console.log('This is the messagesList:', messagesList);
      messagesList.sort((a, b) => new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime());
      mostRecentMessageObj = messagesList[0]?.node.messageObj;
    } else {
      console.log('Just having to take the first one');
      mostRecentMessageObj = candidateProfileDataNodeObj?.whatsappMessages.edges[0].node.messageObj;
    }
    console.log('These are message kwargs length:', mostRecentMessageObj?.length);
    // console.log('This is the most recent message object being considered::', mostRecentMessageObj);
    // chatHistory = await this.getChatHistoryFromMongo(mostRecentMessageObj);
    if (mostRecentMessageObj?.length > 0) mostRecentMessageObj.push({ role: replyObject.isFromMe ? 'assistant' : 'user', content: replyObject.chatReply });
    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      // executorResultObj: {},
      candidateProfile: candidateProfileDataNodeObj,
      whatsappMessageType: candidateProfileDataNodeObj?.whatsappProvider || '',
      candidateFirstName: candidateProfileDataNodeObj.name,
      phoneNumberFrom: candidateProfileDataNodeObj?.phoneNumber,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: replyObject.chatReply }],
      messageType: 'candidateMessage',
      messageObj: mostRecentMessageObj,
      whatsappDeliveryStatus: replyObject.whatsappDeliveryStatus,
      whatsappMessageId: replyObject.whatsappMessageId,
      type: replyObject.type || 'text',
      databaseFilePath: replyObject?.databaseFilePath || '',
    };
    await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    // return whatappUpdateMessageObj;
  }
}
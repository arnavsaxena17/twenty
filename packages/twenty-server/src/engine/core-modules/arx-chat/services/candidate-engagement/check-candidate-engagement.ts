// import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import * as allDataObjects from '../../services/data-model-objects';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './update-chat';
// import { FacebookWhatsappChatApi } from '../../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { WhatsappAPISelector } from '../../services/whatsapp-api/whatsapp-controls';
import { axiosRequest, sortWhatsAppMessages } from '../../utils/arx-chat-agent-utils';
import { ChainValues } from '@langchain/core/utils/types';

import { response } from 'express';
// import { OpenAIArxSingleStepClient } from "../llm-agents/arx-single-step-client";
import { OpenAIArxMultiStepClient } from '../llm-agents/arx-multi-step-client';
import { ToolsForAgents } from '../llm-agents/prompting-tool-calling';
import * as allGraphQLQueries from './graphql-queries-chatbot';

const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export default class CandidateEngagementArx {
  async createAndUpdateCandidateHiChatMessage(chatReply: string, candidateProfileDataNodeObj: allDataObjects.PersonNode) {
    // console.log("This is the candidate profile data node obj:", candidateProfileDataNodeObj);
    console.log('This is the chat reply:', chatReply);
    const recruiterProfile = allDataObjects.recruiterProfile;
    let chatHistory = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj || [];
    if (chatReply === 'hi' && candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents().getSystemPrompt(candidateProfileDataNodeObj);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
      chatHistory.push({ role: 'user', content: 'Hi' });
    } else {
      chatHistory = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    }
    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      // executorResultObj: {},
      candidateProfile: candidateProfileDataNodeObj?.candidates?.edges[0]?.node,
      candidateFirstName: candidateProfileDataNodeObj?.name?.firstName,
      phoneNumberFrom: candidateProfileDataNodeObj?.phone,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'NA',
    };
    await this.updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    // Adding this for now to be able to send messages to the candidates
    // await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj, candidateProfileDataNodeObj, chatHistory);

    return whatappUpdateMessageObj;
  }

  async processCandidate(edge: allDataObjects.PersonEdge, engagementType: 'remind' | 'engage') {
    // console.log('The edge is ::', edge);
    console.log("Engagement Type:", engagementType);
    try {
      const candidateNode = edge.node.candidates.edges[0].node;
      const personNode = edge.node;
      // console.log('This is candidate Node:', candidateNode);
      const messagesList: allDataObjects.WhatsAppMessagesEdge[] = candidateNode?.whatsappMessages?.edges;
      // console.log('Current Messages list:', messagesList);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = this.getMostRecentMessageFromMessagesList(messagesList);
      // console.log('mostRecentMessageArr before chatCompletion:', mostRecentMessageArr);
      if (mostRecentMessageArr?.length > 0) {
        console.log('Taking MULTI Step Client for - Prompt Engineering type:', process.env.PROMPT_ENGINEERING_TYPE);
        let chatAgent = new OpenAIArxMultiStepClient(personNode);
        await chatAgent.createCompletion(mostRecentMessageArr, personNode, engagementType);
      }
    } catch (error) {
      console.log('This is the error in processCandidate', error);
      debugger;
    }
  }
  getMostRecentMessageFromMessagesList(messagesList: allDataObjects.WhatsAppMessagesEdge[]) {
    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = [];
    if (messagesList) {
      messagesList.sort((a, b) => new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime());
      mostRecentMessageArr = messagesList[0]?.node?.messageObj;
      // console.log(mostRecentMessageArr);
    }
    return mostRecentMessageArr;
  }

  async updateCandidateEngagementDataInTable(whatappUpdateMessageObj: allDataObjects.candidateChatMessageType) {
    // console.log("Candidate information before processing:", whatappUpdateMessageObj);
    let candidateProfileObj = whatappUpdateMessageObj.messageType !== 'botMessage' ? await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatappUpdateMessageObj) : whatappUpdateMessageObj.candidateProfile;
    // console.log('Candidate information after processing:', candidateProfileObj);
    // console.log( 'Whatsapp Objs :::', candidateProfileObj.whatsappMessages.edges.map((edge: any) => edge.node.messageObj), );
    if (candidateProfileObj.name === '') return;
    console.log('Candidate information retrieved successfully');
    const whatsappMessage = await new FetchAndUpdateCandidatesChatsWhatsapps().createAndUpdateWhatsappMessage(candidateProfileObj, whatappUpdateMessageObj);
    if (!whatsappMessage) return;
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj);
    if (!updateCandidateStatusObj) return;
    // await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj);
    return { status: 'success', message: 'Candidate engagement status updated successfully', };
  }

  async updateChatHistoryObjCreateWhatsappMessageObj(wamId: string, personNode: allDataObjects.PersonNode, chatHistory: allDataObjects.ChatHistoryItem[]) {
    const candidateNode = personNode.candidates.edges[0].node;
    const updatedChatHistoryObj = {
      // executorResultObj: result,
      messageObj: chatHistory,
      candidateProfile: candidateNode,
      candidateFirstName: personNode.name?.firstName,
      phoneNumberFrom: allDataObjects.recruiterProfile?.phone,
      phoneNumberTo: personNode.phone,
      messages: chatHistory.slice(-1),
      messageType: 'botMessage',
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: wamId,
    };
    return updatedChatHistoryObj;
  }

  filterCandidates(sortedPeopleData: allDataObjects.People) {
    // console.log("This is filter candidates:", sortedPeopleData)
    return sortedPeopleData?.edges?.filter(edge => edge?.node?.candidates?.edges?.length > 0 && edge?.node?.candidates?.edges[0]?.node?.engagementStatus);
  }

  async startChatEngagement(candidateResponseEngagementObj: allDataObjects.RootObject) {
    console.log('Total number of candidates fetched to filter for start chat::', candidateResponseEngagementObj?.people?.edges?.length);
    const filteredCandidatesToStartEngagement = candidateResponseEngagementObj?.people?.edges?.filter(edge => {
      return edge?.node?.candidates?.edges?.length > 0 && edge?.node?.candidates?.edges[0]?.node?.startChat === true;
    });
    console.log('these are the number of candidates to who have no filteredCandidatesToStartEngagement ::', filteredCandidatesToStartEngagement?.length);
    const filteredCandidatesWhoHaveNoWhatsappHistory = filteredCandidatesToStartEngagement?.filter(edge => {
      return edge?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0;
    });
    console.log('these are the number of candidates to start chat ::', filteredCandidatesWhoHaveNoWhatsappHistory?.length);
    for (let i = 0; i < filteredCandidatesWhoHaveNoWhatsappHistory?.length; i++) {
      const chatReply = 'hi';
      const candidateProfileDataNodeObj = filteredCandidatesWhoHaveNoWhatsappHistory[i].node;
      await new CandidateEngagementArx().createAndUpdateCandidateHiChatMessage(chatReply, candidateProfileDataNodeObj);
      // const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().setCandidateEngagementStatusToFalse(candidateProfileDataNodeObj.candidates.edges[0].node);
    }
  }

  async engageCandidates(candidateResponseEngagementObj: allDataObjects.RootObject) {
    // console.log("This is candidateResponseEngagementObj:", candidateResponseEngagementObj)
    const sortedPeopleData = sortWhatsAppMessages(candidateResponseEngagementObj?.people);
    const filteredCandidates = this.filterCandidates(sortedPeopleData);
    console.log('Filtered candidates to engage:', filteredCandidates);
    const listOfCandidatesToRemind: allDataObjects.PersonEdge[] = candidateResponseEngagementObj?.people?.edges?.filter((edge: allDataObjects.PersonEdge) => {
      edge?.node?.candidates?.edges[0]?.node?.candidateReminders?.edges?.filter(reminderEdge => reminderEdge?.node?.remindCandidateAtTimestamp < new Date().toISOString() && reminderEdge?.node?.isReminderActive);
    });

    for (const edge of listOfCandidatesToRemind) {
      await this.processCandidate(edge, 'remind');
      edge.node.candidates.edges?.forEach(candidateEdge => {
        candidateEdge.node.candidateReminders.edges.forEach(candidateReminder => {
          new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateReminderStatus(candidateReminder.node);
        });
      });
    }

    console.log('Number processCandidateof filtered candidates to engage:', filteredCandidates?.length);
    for (const edge of filteredCandidates) {
      await this.processCandidate(edge, 'engage');
      // await new FetchAndUpdateCandidatesChatsWhatsapps().setCandidateEngagementStatusToFalse(edge.node.candidates[0]);
    }
  }

  // async checkAvailableRemindersAndSend() {
  //   const graphqlQueryObj = JSON.stringify({
  //     query: allGraphQLQueries.graphqlQueryToFindEngagedCandidates,
  //     variables: {},
  //   });
  //   const response = await axiosRequest(graphqlQueryObj);
  //   const listOfCandidatesToRemind: allDataObjects.PersonEdge[] = response?.data?.data?.people?.edges?.filter((edge: allDataObjects.PersonEdge) => {
  //     edge?.node?.candidates?.edges[0]?.node?.candidateReminders?.edges?.filter((reminderEdge) => reminderEdge?.node?.remindCandidateAtTimestamp < new Date().toISOString() && reminderEdge?.node?.isReminderActive);
  //   });
  //   console.log("Number of candidates to remind:", listOfCandidatesToRemind?.length);
  //   for (const edge of listOfCandidatesToRemind) {
  //     const candidateNode = edge?.node?.candidates.edges[0].node;
  //     const personNode = edge?.node;
  //     const messagesList: allDataObjects.WhatsAppMessagesEdge[] = candidateNode?.whatsappMessages?.edges;
  //     let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = this.getMostRecentMessageFromMessagesList(messagesList);
  //     console.log("mostRecentMessageArr before chatCompletion:", mostRecentMessageArr);

  //     const REMIND_SYSTEM_PROMPT = await new ToolsForAgents().getReminderSystemPrompt();
  //     mostRecentMessageArr[0] = { role: "system", content: REMIND_SYSTEM_PROMPT, };
  //     const recruiterProfile = allDataObjects.recruiterProfile;

  //     let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
  //       // executorResultObj: {},
  //       candidateProfile: candidateNode,
  //       candidateFirstName: personNode?.name?.firstName,
  //       phoneNumberFrom: personNode?.phone,
  //       phoneNumberTo: recruiterProfile.phone,
  //       messages: [{ content: REMIND_SYSTEM_PROMPT }],
  //       messageType: "candidateMessage",
  //       messageObj: mostRecentMessageArr,
  //       whatsappDeliveryStatus: "reminderTriggered",
  //       whatsappMessageId: "NA",
  //     };
  //     await this.updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
  //     const chatAgent = new OpenAIArxMultiStepClient(personNode);
  //     const engagementType = "remind"
  //     await chatAgent.createCompletion(mostRecentMessageArr, personNode, engagementType);

  //     candidateNode?.candidateReminders?.edges?.forEach((reminderEdge) => {
  //       new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateReminderStatus(reminderEdge.node);
  //     });
  //   }
  // }

  async checkCandidateEngagement() {
    // await this.checkAvailableRemindersAndSend();
    const response = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchCandidatesToEngage();
    const candidateResponseEngagementObj = response?.data?.data;
    await this.startChatEngagement(candidateResponseEngagementObj);
    await this.engageCandidates(candidateResponseEngagementObj);
    return;
  }
}
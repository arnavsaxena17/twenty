import * as allDataObjects from '../../services/data-model-objects';
import { AttachmentProcessingService } from '../../services/candidate-engagement/attachment-processing';
import { WhatsappAPISelector } from '../../services/whatsapp-api/whatsapp-controls';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../services/candidate-engagement/update-chat';

export async function shareJDtoCandidate(person: allDataObjects.PersonNode) {
  console.log('This is the person for which we are trying to send the JD:', person);
  const candidateId = person?.candidates?.edges[0]?.node?.id;
  console.log('This is the candidateID for which we are trying to send the JD:', candidateId);
  const jobId = person?.candidates?.edges[0]?.node?.jobs?.id;
  console.log('This is the jobId for which we are trying to send the JD:', jobId);
  const jDPath = person?.candidates?.edges[0]?.node?.jobs;
  console.log('This is the jDPath for which we are trying to send the JD:', jDPath);
  const jobAttachments = (await new AttachmentProcessingService().fetchAllAttachmentsByJobId(jobId)) ?? [];
  console.log('Job Attachments:', jobAttachments);
  if (!jobAttachments) {
    console.log('No attachments found for this job');
  }
  const attachment = jobAttachments?.node ?? '';
  await new WhatsappAPISelector().sendJDViaWhatsapp( person, attachment, );
}

export async function updateCandidateStatus(person: allDataObjects.PersonNode, status: string) {
  console.log('Updating the candidate status::', status);
  const candidateId = person?.candidates?.edges[0]?.node?.id;
  console.log('This is the candidateID for which we are trying to update the status:', candidateId);
  const candidateProfileObj = person?.candidates?.edges[0]?.node;
  let UpdateCandidateMessageObj: allDataObjects.candidateChatMessageType = {
    // executorResultObj: {},
    candidateProfile: person?.candidates?.edges[0]?.node,
    candidateFirstName: person?.name?.firstName,
    phoneNumberFrom: person?.phone,
    phoneNumberTo: allDataObjects.recruiterProfile.phone,
    messages: [{ content: status }],
    messageType: status,
    messageObj: [],
    whatsappDeliveryStatus: 'updateCandidateStatus',
    whatsappMessageId: 'updateCandidateStatus',
  };
  const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateProfileStatus(candidateProfileObj, UpdateCandidateMessageObj);
  console.log("This is the updateCandidateStatusObj:", updateCandidateStatusObj)
  return 'Updated the candidate profile with the status.';
}

export async function scheduleCandidateInterview(person: allDataObjects.PersonNode, status: string) {
  console.log('Updating the candidate interview schedule');
  const candidateId = person?.candidates?.edges[0]?.node?.id;
  console.log('This is the candidateID for which we are trying to update the status:', candidateId);
  const candidateProfileObj = person?.candidates?.edges[0]?.node;
  let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
    // executorResultObj: {},
    candidateProfile: person?.candidates?.edges[0]?.node,
    candidateFirstName: person?.name?.firstName,
    phoneNumberFrom: person?.phone,
    phoneNumberTo: allDataObjects.recruiterProfile.phone,
    messages: [{ content: status }],
    messageType: status,
    messageObj: [],
    whatsappDeliveryStatus: 'scheduleCandidateInterview',
    whatsappMessageId: 'scheduleCandidateInterview',
  };
  const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateProfileStatus(candidateProfileObj, whatappUpdateMessageObj);
  return 'Updated the candidate interview schedule.';
}

export async function updateAnswerInDatabase(person: allDataObjects.PersonNode, AnswerMessageObj: any) {
  console.log('Updating the candidate answer in database');
  const candidateId = person?.candidates?.edges[0]?.node?.id;
  console.log('This is the candidateID for which we are trying to update the status:', candidateId);
  const candidateProfileObj = person?.candidates?.edges[0]?.node;
  const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateAnswer(candidateProfileObj, AnswerMessageObj);
  return 'Updated the candidate answer in the database.';
}
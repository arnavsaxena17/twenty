import React, { useState, useEffect,useRef } from 'react';
import styled from '@emotion/styled';
import * as InterviewResponseTypes from './types/interviewResponseTypes';
import { VideoPlayer } from './utils/videoPlaybackUtils';
import {recruiterProfile} from '../../activities/chats/types/front-chat-types';


import {
  StyledContainer,
  StyledLeftPanelContentBox,
  StyledTextLeftPanelTextHeadline,
  StyledTextLeftPaneldisplay,
  StartInterviewStyledLeftPanel,
  StartInterviewStyledRightPanel,
  StyledButton,
  ButtonContainer,
  InstructionSection,
  InstructionList,
  AccessMessage,

} from './styled-components/StyledComponentsInterviewResponse';

export const StartInterviewPage: React.FC<InterviewResponseTypes.StartInterviewPageProps> = ({ onStart, InterviewData, introductionVideoData }) => {

  const [hasAccess, setHasAccess] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    checkMediaAccess();
  }, []);

  const checkMediaAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setHasAccess(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      setHasAccess(false);
    }
  };

  const requestMediaAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setHasAccess(true);
    } catch (err) {
      console.error('Trying to get media access:', err);
      // alert('Failed to get camera and microphone access. Please check your browser settings and try again.');
    }
  };

  console.log("This is the intorduction interview data::", introductionVideoData)
  console.log("This is the intorduction interview data::", introductionVideoData?.data?.attachments?.edges[0]?.node.fullPath)
  const introductionVideoURL = process.env.REACT_APP_SERVER_BASE_URL+"/"+introductionVideoData?.data?.attachments?.edges[0]?.node.fullPath;
  console.log("THis is introductionVideoURL:", introductionVideoURL)
  return (
    <StyledContainer>
    <StartInterviewStyledLeftPanel>
      <h2>{InterviewData?.candidate?.jobs?.name}</h2>
      <StyledLeftPanelContentBox>
        <StyledTextLeftPanelTextHeadline>Introduction</StyledTextLeftPanelTextHeadline>
        <VideoPlayer src={process.env.REACT_APP_SERVER_BASE_URL+"/files/"+introductionVideoData?.data?.attachments?.edges[0]?.node?.fullPath} videoRef={videoRef} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
        <h3>Transcript</h3>
        <StyledTextLeftPaneldisplay>
        {InterviewData?.aIInterview?.introduction}
        </StyledTextLeftPaneldisplay>
      </StyledLeftPanelContentBox>
    </StartInterviewStyledLeftPanel>
    <StartInterviewStyledRightPanel>
      <InstructionSection>
        <h2>Hi, {InterviewData?.candidate?.people?.name?.firstName} (Application for {InterviewData?.candidate?.jobs?.name} at {InterviewData?.candidate?.jobs?.companyName})</h2>

        <br></br>
        <h3>Instructions</h3>
        <InstructionList>
          <li>You have to answer {InterviewData?.aIInterview?.aIInterviewQuestions.edges.length} questions and will have 4 minutes per question.</li>
          <li>Answer all {InterviewData?.aIInterview?.aIInterviewQuestions.edges.length} questions in one go. Do not click back, close or refresh the tab to prevent loss of progress.</li>
          <li>Do not worry about the quality of your video. Focus only on the quality of answers.</li>
          <li>Please provide your browser access to camera and microphone on your device to start interview</li>
          <li>Please make sure you have a stable internet connection and use a fully charged device for giving the interview.</li>
          <li>If you need assistance, write to me <a href={`mailto:${recruiterProfile.email}`}>{recruiterProfile.email}</a> or call/ whatsapp at <a href={`tel:${recruiterProfile.phone}`}>{recruiterProfile.phone}</a></li>
        </InstructionList>
      </InstructionSection>
          <ButtonContainer>
            {!hasAccess ? ( <StyledButton onClick={requestMediaAccess}> Give camera and microphone access </StyledButton> ) : ( <AccessMessage>✓ Camera and microphone access granted</AccessMessage> )}
            {hasAccess && ( <StyledButton onClick={onStart}> Start Interview </StyledButton> )}
          </ButtonContainer>
    </StartInterviewStyledRightPanel>
  </StyledContainer>
); 
};
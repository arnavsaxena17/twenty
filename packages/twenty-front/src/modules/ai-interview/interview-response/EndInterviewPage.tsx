import React, { useState } from 'react';
import styled from '@emotion/styled';
import {
  EndInterviewStyledContainer,
  FeedbackContainer,
  StyledMessage,
  FeedbackPrompt,
  StyledTextArea,
  SubmitButton,
  EndInterviewStyledLeftPanel,
  EndInterviewStyledRightPanel,
} from './styled-components/StyledComponentsInterviewResponse';
import { InterviewData } from './types/interviewResponseTypes';



export const EndInterviewPage: React.FC<{ interviewData:InterviewData, onSubmit: (feedback: string) => void }> = ({ interviewData, onSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = () => {
    onSubmit(feedback);
    setSubmitted(true);
  };
  return (
    <EndInterviewStyledContainer>
      <EndInterviewStyledLeftPanel>
        <h2>{interviewData.candidate.jobs.name}</h2>
        <p>Interview Complete</p>
      </EndInterviewStyledLeftPanel>
      <EndInterviewStyledRightPanel>
        {submitted ? (
            <FeedbackContainer>
            <h2>Thank You for Your Feedback</h2>
            <StyledMessage>
              Your feedback has been submitted successfully. You may now close this window.
            </StyledMessage>
            </FeedbackContainer>
        ) : (
          <FeedbackContainer>
            <h2>Thank You for Completing the Interview</h2>
            <FeedbackPrompt> We appreciate your time and effort. Please share any additional inputs you have for the interviewer or about the interview process. </FeedbackPrompt>
            <StyledTextArea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter your feedback here..."
            />
            <SubmitButton onClick={handleSubmit}>Share Feedback</SubmitButton>
          </FeedbackContainer>
        )}
      </EndInterviewStyledRightPanel>
    </EndInterviewStyledContainer>
  );
};
import React from 'react';
import styled from "@emotion/styled";
import * as frontChatTypes from "../types/front-chat-types";

const StyledTable = styled.table`
  width: max-content;
  border-collapse: collapse;
`;

const StyledTableCell = styled.td`
  padding: 10px;
  border-bottom: 1px solid #e0e0e0;
  white-space: nowrap;
`;

const StyledTableHeaderCell = styled.th`
  padding: 10px;
  text-align: left;
  white-space: nowrap;
`;

const StyledTableBody = styled.tbody`
  background-color: #ffffff;
`;

const StyledTableHeader = styled.thead`
  position: sticky;
  top: 0;
  background-color: #f0f0f0;
  z-index: 1;
`;

const StyledTableRow = styled.tr<{ $selected: boolean }>`
  background-color: ${(props) => (props.$selected ? "#f5f9fd" : "white")};
  cursor: pointer;
  &:hover {
    background-color: ${(props) => (props.$selected ? "#f5f9fd" : "#f0f0f0")};
  }
`;

const UnreadIndicator = styled.span`
  background-color: red;
  color: white;
  border-radius: 50%;
  padding: 0.25rem 0.5rem;
  margin-left: 0.5rem;
  font-size: 0.8rem;
  min-height: 1rem;
  min-width: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;


const NameCell = styled.div`
  display: flex;
  align-items: center;
`;



const ChatTable: React.FC<frontChatTypes.ChatTableProps> = ({
  individuals,
  selectedIndividual,
  unreadMessages,
  onIndividualSelect,
}) => {

  const getUnreadCount = (individualId: string) => {
    const unreadInfo = unreadMessages.listOfUnreadMessages.find(
      (item) => item.candidateId === individualId
    );
    return unreadInfo ? unreadInfo.ManyUnreadMessages.length : 0;
  };
  
  
  return (
    <StyledTable>
      <StyledTableHeader>
        <tr>
          <StyledTableHeaderCell>Name</StyledTableHeaderCell>
          <StyledTableHeaderCell>Status</StyledTableHeaderCell>
          <StyledTableHeaderCell>Salary</StyledTableHeaderCell>
          <StyledTableHeaderCell>City</StyledTableHeaderCell>
          <StyledTableHeaderCell>Job Title</StyledTableHeaderCell>
        </tr>
      </StyledTableHeader>
      <StyledTableBody>
        {individuals.map((individual: frontChatTypes.PersonNode) => {
          const unreadCount = getUnreadCount(individual.id);
          return (
            <StyledTableRow key={individual.id} $selected={selectedIndividual === individual.id} onClick={() => onIndividualSelect(individual.id)} >
              <StyledTableCell>
                <NameCell> {`${individual.name.firstName} ${individual.name.lastName}`} {unreadCount > 0 && ( <UnreadIndicator>{unreadCount}</UnreadIndicator> )} </NameCell>
              </StyledTableCell>
              <StyledTableCell>{individual.candidates?.edges[0]?.node?.status || 'N/A'}</StyledTableCell>
              <StyledTableCell>{individual.salary || 'N/A'}</StyledTableCell>
              <StyledTableCell>{individual.city || 'N/A'}</StyledTableCell>
              <StyledTableCell>{individual.jobTitle || 'N/A'}</StyledTableCell>
            </StyledTableRow>
          );
        })}
      </StyledTableBody>
    </StyledTable>
  );
};

export default ChatTable;
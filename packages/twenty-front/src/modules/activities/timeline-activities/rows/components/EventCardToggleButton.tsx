import styled from '@emotion/styled';
import { IconButton, IconChevronDown, IconChevronUp } from 'twenty-ui';

type EventCardToggleButtonProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

const StyledButtonContainer = styled.div`
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

export const EventCardToggleButton = ({
  isOpen,
  setIsOpen,
}: EventCardToggleButtonProps) => {
  return (
    <StyledButtonContainer>
      <IconButton
        Icon={isOpen ? IconChevronUp : IconChevronDown}
        onClick={() => setIsOpen(!isOpen)}
        size="small"
        variant="secondary"
      />
    </StyledButtonContainer>
  );
};
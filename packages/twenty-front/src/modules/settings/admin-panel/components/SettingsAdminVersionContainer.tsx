import { SettingsAdminTableCard } from '@/settings/admin-panel/components/SettingsAdminTableCard';
import { checkTwentyVersionExists } from '@/settings/admin-panel/utils/checkTwentyVersionExists';
import { fetchLatestTwentyRelease } from '@/settings/admin-panel/utils/fetchLatestTwentyRelease';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import packageJson from '../../../../../package.json';
import { GITHUB_LINK } from 'twenty-ui/navigation';
import { IconCircleDot, IconStatusChange } from 'twenty-ui/display';

const StyledActionLink = styled.a`
  align-items: center;
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  gap: ${({ theme }) => theme.spacing(1)};
  text-decoration: none;

  :hover {
    color: ${({ theme }) => theme.font.color.primary};
    cursor: pointer;
  }
`;

const StyledSpan = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.regular};
`;

export const SettingsAdminVersionContainer = () => {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [currentVersionExists, setCurrentVersionExists] = useState(false);

  useEffect(() => {
    fetchLatestTwentyRelease().then(setLatestVersion);
    checkTwentyVersionExists(packageJson.version).then(setCurrentVersionExists);
  }, []);

  const versionItems = [
    {
      Icon: IconCircleDot,
      label: t`Current version`,
      value: currentVersionExists ? (
        <StyledActionLink
          href={`${GITHUB_LINK}/releases/tag/v${packageJson.version}`}
          target="_blank"
          rel="noreferrer"
        >
          {packageJson.version}
        </StyledActionLink>
      ) : (
        <StyledSpan>{packageJson.version}</StyledSpan>
      ),
    },
    {
      Icon: IconStatusChange,
      label: t`Latest version`,
      value: latestVersion ? (
        <StyledActionLink
          href={`${GITHUB_LINK}/releases/tag/v${latestVersion}`}
          target="_blank"
          rel="noreferrer"
        >
          {latestVersion}
        </StyledActionLink>
      ) : (
        <StyledSpan>{latestVersion ?? 'Loading...'}</StyledSpan>
      ),
    },
  ];

  return (
    <SettingsAdminTableCard
      rounded
      items={versionItems}
      gridAutoColumns="3fr 8fr"
    />
  );
};

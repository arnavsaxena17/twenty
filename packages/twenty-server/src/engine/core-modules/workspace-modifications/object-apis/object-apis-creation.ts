import { createObjectMetadataItems } from './services/object-service';
import { createRelations } from './services/relation-service';
import { createFields } from './services/field-service';
import { QueryResponse, ObjectMetadata } from './types/types.js';
import axios from 'axios';
import { WorkspaceQueryService } from '../workspace-modifications.service.js';
import { executeQuery } from './utils/graphqlClient.js';
import { objectCreationArr } from './data/objectsData';
import { getFieldsData } from './data/fieldsData';
import { getRelationsData } from './data/relationsData';
import { createAIInterviews, getJobIds } from './services/aiInterviewService';
import { createAIModels, getAIModelIds } from './services/aiModelService';
import { createArxEnrichments } from './services/arxEnrichmentsService';
import { JobCreationService } from './services/jobCreationService';
import { candidatesData } from './data/candidatesData';
import { ApiKeyService } from './services/apiKeyCreation';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';

export class CreateMetaDataStructure {
  private readonly sheetsService: GoogleSheetsService;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {
  }
  async axiosRequest(data: string, apiToken: string) {

    const response = await axios.request({
      method: 'post',
      url: process.env.GRAPHQL_URL,
      headers: {
        authorization: 'Bearer ' + apiToken,
        'content-type': 'application/json',
      },
      data: data,
    });
    return response;
  }

  async fetchFieldsPage(objectId: string, cursor: string | null, apiToken: string) {
    try {
      const response = await executeQuery<any>(
        `
        query ObjectMetadataItems($after: ConnectionCursor, $objectFilter: objectFilter) {
          objects(paging: {first: 100, after: $after}, filter: $objectFilter) {
            edges {
              node {
                id
                nameSingular
                namePlural
                fields(paging: {first: 1000}) {
                  edges {
                    node {
                      name
                      id
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
        `,
        {
          after: cursor || undefined,
          objectFilter: {
            id: { eq: objectId }
          }
        },  
        apiToken
      );
      
      console.log('fetchFieldsPage response:', response.data);
      return response;
  
    } catch (error) {
      console.error('Error fetching fields page:', error);
      throw error;
    }
  }    
  fetchAllObjects = async (apiToken: string) => {
    const objectsResponse = await executeQuery<QueryResponse<ObjectMetadata>>(
      `
        query ObjectMetadataItems($objectFilter: objectFilter, $fieldFilter: fieldFilter) {
          objects(paging: {first: 1000}, filter: $objectFilter) {
            edges {
              node {
                id
                nameSingular
                namePlural
                labelSingular
                labelPlural
                fields(paging: {first: 1000}, filter: $fieldFilter) {
                  edges {
                    node {
                      name
                      id
                    }
                  }
                }
              }
            }
          }
        }`,
      {},
      apiToken,
    );
    return objectsResponse;
  };

  async fetchObjectsNameIdMap(apiToken: string): Promise<Record<string, string>> {
    const objectsResponse = await this.fetchAllObjects(apiToken);
    console.log('objectsResponse:', objectsResponse);
    console.log("objectsResponse.data.data.objects.edges length", objectsResponse?.data?.objects?.edges?.length);
    const objectsNameIdMap: Record<string, string> = {};
    objectsResponse?.data?.objects?.edges?.forEach(edge => {
      if (edge?.node?.nameSingular && edge?.node?.id) {

        objectsNameIdMap[edge?.node?.nameSingular] = edge?.node?.id;
      }
    });
    console.log('objectsNameIdMap', objectsNameIdMap);
    return objectsNameIdMap;
  }

  async createAndUpdateWorkspaceMember(apiToken: string) {


    const currentWorkspaceMemberResponse = await this.axiosRequest(
      JSON.stringify({
      operationName: 'FindManyWorkspaceMembers',
      variables: {
        limit: 60,
        orderBy: [{ createdAt: 'AscNullsLast' }],
      },
      query: `
        query FindManyWorkspaceMembers($filter: WorkspaceMemberFilterInput, $orderBy: [WorkspaceMemberOrderByInput], $lastCursor: String, $limit: Int) {
          workspaceMembers(
            filter: $filter
            orderBy: $orderBy
            first: $limit
            after: $lastCursor
          ) {
            edges {
              node {
                id
                name {
                  firstName
                  lastName
                }
              }
            }
          }
        }`,
      }),
      apiToken,
    );

    const currentWorkspaceMemberId = currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node.id;
    console.log("currentWorkspaceMemberId", currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node);
    const currentWorkspaceMemberName = currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node.name.firstName + ' ' + currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node.name.lastName;
    const createResponse = await this.axiosRequest(
      JSON.stringify({
        operationName: 'CreateOneWorkspaceMemberType',
        variables: {
          input: {
            typeWorkspaceMember: 'recruiterType',
            name: currentWorkspaceMemberName,
            workspaceMemberId: currentWorkspaceMemberId,
            position: 'first',
          },
        },
        query: `mutation CreateOneWorkspaceMemberType($input: WorkspaceMemberTypeCreateInput!) {
                createWorkspaceMemberType(data: $input) {
                  __typename
                  id
                  workspaceMember {
                    id
                  }
                }
            }`,
      }),
      apiToken,
    );
    console.log('Workpace member created successfully', createResponse.data);
    return currentWorkspaceMemberId;
  }

  async createMetadataStructure(apiToken: string): Promise<void> {
    try {
      console.log('Starting metadata structure creation...');

      await createObjectMetadataItems(apiToken, objectCreationArr);
      console.log('Object metadata items created successfully');

      const objectsNameIdMap = await this.fetchObjectsNameIdMap(apiToken);

      const fieldsData = getFieldsData(objectsNameIdMap);

      console.log("Number of fieldsData", fieldsData.length);

      await createFields(fieldsData, apiToken);
      console.log('Fields created successfully');
      const relationsFields = getRelationsData(objectsNameIdMap);

      await createRelations(relationsFields, apiToken);
      console.log('Relations created successfully');

      const aiModelIds = await createAIModels(apiToken);
      console.log('AI Models created successfully');

      // Get Job IDs
      const jobIds = await getJobIds(apiToken);
      // Create AI Interviews
      await createAIInterviews(aiModelIds, jobIds, apiToken);
      console.log('AI Interviews created successfully');
      await createArxEnrichments(apiToken);
      console.log('AI Interviews created successfully');
      const apiKeyService = new ApiKeyService();
      const workspaceMemberId = await this.createAndUpdateWorkspaceMember(apiToken);
      // console.log('Metadata structure creation completed');
      const apiKey = await apiKeyService.createApiKey(apiToken);
      // console.log('API key created successfully:', apiKey);
      const jobCreationService = new JobCreationService(
        apiToken,
        this.sheetsService,
        process.env.SERVER_BASE_URL
      );

      const sampleJobs = [
        'Sample Job1',
        'Sample Job2',
        'Sample Job3',
        'Sample Job4'
      ];
      const arxenaJobIds = [
        '64b29dbdf9822851831e4de9',
        '64b29dbdf9822851831e4dea',
        '64b29dbdf9822851831e4deb',
        '64b29dbdf9822851831e4dec'
      ];

      for (let i = 0; i < sampleJobs.length; i++) {
        const jobName = sampleJobs[i];
        const arxenaJobId = arxenaJobIds[i];
        await new Promise(resolve => setTimeout(resolve, 5000));
        const result = await jobCreationService.executeJobCreationFlow(
          jobName,
          candidatesData,
          apiKey,
          arxenaJobId
        );
        console.log(`Created job ${jobName} with spreadsheet ID: ${result?.googleSheetUrl}`);
      }
    } catch (error) {
      console.log('Error creating metadata structure:', error);
    }
  }
}
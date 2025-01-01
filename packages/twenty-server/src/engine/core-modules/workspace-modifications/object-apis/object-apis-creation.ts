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
export class CreateMetaDataStructure {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
  async axiosRequest(data: string, apiToken: string) {
    // console.log("Sending a post request to the graphql server:: with data", data);
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
      // const apiKeyService = new ApiKeyService();
      const workspaceMemberId = await this.createAndUpdateWorkspaceMember(apiToken);
      console.log('Metadata structure creation completed');
      // const apiKey = await apiKeyService.createApiKey(apiToken);
      // console.log('API key created successfully:', apiKey);
      // const jobCreationService = new JobCreationService(apiToken);
      // const result = await jobCreationService.executeJobCreationFlow( 'Sample Job', candidatesData );
      // console.log('Job creation flow completed:', result);
    } catch (error) {
      console.log('Error creating metadata structure:', error);
    }
  }
}

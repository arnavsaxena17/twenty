import * as deliveryManagementTypes from '../types/delivery-management.types';
import { NotificationService } from '../services/notification-service';
import { AssessmentManager } from './phase-3-assessment-manager';
import { InterviewManager } from './phase-5-interview-manager';
import { DeliveryManagementSystem } from '../services/delivery-management-system';
import { EventTrackingSystem } from '../services/event-tracking-system';
import { TaskManagementSystem } from '../services/task-management-system';

export class CVSharingManager {
    private cvShares: Map<string, deliveryManagementTypes.CVShare>;
    private candidateCVs: Map<string, deliveryManagementTypes.CV[]>;
    notificationService: NotificationService;
    assessmentManager: AssessmentManager;
    interviewManager: InterviewManager;
    deliveryManagementSystem: DeliveryManagementSystem;
    taskManagementSystem: TaskManagementSystem;

    constructor(
        private candidates: Map<string, deliveryManagementTypes.Candidate>,
        private clients: Map<string, deliveryManagementTypes.Client>,
        private eventTracker: EventTrackingSystem
    ) {
        this.cvShares = new Map();
        this.candidateCVs = new Map();
        this.notificationService = new NotificationService();
        this.assessmentManager = new AssessmentManager(this.candidates);
        this.interviewManager = new InterviewManager(this.candidates, this.clients);
        this.deliveryManagementSystem = new DeliveryManagementSystem();
    }

    private async processCandidateRejection(response: deliveryManagementTypes.ClientResponse, share: deliveryManagementTypes.CVShare): Promise<void> {
        const rejectionDetails = response.details as deliveryManagementTypes.RejectionDetails;

        // Update candidate status
        await this.deliveryManagementSystem.updateCandidateStatus(
            response.candidateId,
            deliveryManagementTypes.CandidateStatus.REJECTED
        );

        // Store rejection details
        await this.storeRejectionFeedback(response.candidateId, rejectionDetails);

        // Update candidate pipeline
        if (rejectionDetails.possibleFutureMatch) {
            await this.addToPotentialPool(response.candidateId, rejectionDetails);
        }

        // Notify recruiter
        await this.notifyRejection(response, share);

        // Log event
        this.eventTracker.logEvent({
            type: deliveryManagementTypes.EventType.CANDIDATE_REJECTED,
            candidateId: response.candidateId,
            details: rejectionDetails,
            eventType: '',
            timestamp: new Date()
        });
    }
    addToPotentialPool(candidateId: string, rejectionDetails: deliveryManagementTypes.RejectionDetails) {
        throw new Error('Method not implemented.');
    }
    storeRejectionFeedback(candidateId: string, rejectionDetails: deliveryManagementTypes.RejectionDetails) {
        throw new Error('Method not implemented.');
    }

    private async updateShareStatus(share: deliveryManagementTypes.CVShare, response: deliveryManagementTypes.ClientResponse): Promise<void> {
        share.status = deliveryManagementTypes.CVShareStatus.VIEWED;
        share.feedback = {
            stakeholderId: response.stakeholderId,
            decision: response.decision,
            timestamp: new Date(),
            rating: 0, // Add appropriate value
            comments: '', // Add appropriate value
            skillAssessment: new Map<string, number>(), // Add appropriate value
            interestLevel: "medium" // Add appropriate value
        };

        this.cvShares.set(share.id, share);
    }

    private async notifyInterviewInitiated(response: deliveryManagementTypes.ClientResponse, share: deliveryManagementTypes.CVShare): Promise<void> {
        // Notify candidate
        await this.notificationService.sendNotification(
            response.candidateId,
            deliveryManagementTypes.NotificationType.INTERVIEW_SCHEDULED,
            {
                subject: 'Interview Scheduled',
                message: 'Your interview has been scheduled.',
                candidateId: response.candidateId,
                shareId: share.id,
                clientId: share.clientId,
                recruiterId: share.recruiterId
            }
        );

        // Notify recruiter
        await this.notificationService.sendNotification(
            share.recruiterId,
            deliveryManagementTypes.NotificationType.INTERVIEW_SCHEDULED,
            {
                subject: 'Interview Scheduled',
                message: 'An interview has been scheduled.',
                candidateId: response.candidateId,
                shareId: share.id,
                clientId: share.clientId,
                recruiterId: share.recruiterId
            }
        );

        // Notify client stakeholders
        await this.notifyStakeholders(
            share.clientId,
            'interview_scheduled',
            { interview: {} as deliveryManagementTypes.Interview }, // or appropriate value
            share
        );
    }

    private async notifyAssessmentInitiated(assessment: deliveryManagementTypes.Assessment, response: deliveryManagementTypes.ClientResponse): Promise<void> {
        // Similar notification pattern as interview
        // ... implementation
    }

    private async notifyRejection(response: deliveryManagementTypes.ClientResponse, share: deliveryManagementTypes.CVShare): Promise<void> {
        // Notify recruiter only - candidate notification handled separately
        await this.notificationService.sendNotification(
            share.recruiterId,
            deliveryManagementTypes.NotificationType.CANDIDATE_REJECTED,
            {
                candidateId: response.candidateId,
                clientId: share.clientId,
                subject: '',
                message: '',
                shareId: '',
                recruiterId: ''
            }
        );
    }

    private calculateReminderSchedule(request: deliveryManagementTypes.AssessmentRequest): deliveryManagementTypes.ReminderSchedule {
        // Calculate reminder points based on deadline and priority
        const deadlineDate = new Date(request.deadline);
        const now = new Date();
        const daysUntilDeadline = Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
            initial: now,
            reminders: this.generateReminderDates(daysUntilDeadline, request.priority),
            final: new Date(deadlineDate.getTime() - (24 * 60 * 60 * 1000)) // 1 day before
        };
    }

    generateReminderDates(daysUntilDeadline: number, priority: string): Date[] {
        throw new Error('Method not implemented.');
    }

    async prepareCV(candidateId: string, clientId: string, options: deliveryManagementTypes.CVCustomization): Promise<deliveryManagementTypes.CV> {
        const candidate = this.candidates.get(candidateId);
        if (!candidate) throw new Error('Candidate not found');

        const baseCV = await this.getLatestCV(candidateId);
        return this.customizeCV(baseCV, clientId, options);
    }

    async shareCV(
        candidateId: string,
        clientId: string,
        recruiterId: string,
        options: {
            expiryDays: number;
            anonymize: boolean;
            customization?: deliveryManagementTypes.CVCustomization;
        }
    ): Promise<deliveryManagementTypes.CVShare> {
        const defaultCustomization: deliveryManagementTypes.CVCustomization = {
            clientId: clientId,
            modifications: {
                hidePersonalInfo: false,
                emphasizedSkills: [],
                hiddenDetails: [],
                reorderedSections: []
            }
        };
        const cv = await this.prepareCV(candidateId, clientId, { ...defaultCustomization, ...options.customization });

        const share: deliveryManagementTypes.CVShare = {
            id: generateUniqueId(),
            cvId: cv.id,
            candidateId,
            clientId,
            recruiterId,
            sharedAt: new Date(),
            expiresAt: new Date(Date.now() + options.expiryDays * 24 * 60 * 60 * 1000),
            status: deliveryManagementTypes.CVShareStatus.PENDING,
            viewHistory: [],
            share: {
                stakeholderId: '',
                decision: deliveryManagementTypes.ClientDecision.SCHEDULE_INTERVIEW,
                timestamp: new Date()
            }
        };

        this.cvShares.set(share.id, share);
        await this.notifyStakeholders(
            share.clientId,
            'new_cv_shared',
            { interview: {} as deliveryManagementTypes.Interview }, // or appropriate value
            share
        );

        return share;
    }

    async notifyStakeholders(clientId: string, p0: string, p1: { interview: deliveryManagementTypes.Interview; }, share: deliveryManagementTypes.CVShare): Promise<void> {
        const client = this.clients.get(share.clientId);
        if (!client) throw new Error('Client not found');
        const relevantStakeholders = client.stakeholders.filter(
            s => s.permissions.canViewDocuments
        );

        for (const stakeholder of relevantStakeholders) {
            await this.notificationService.sendNotification(
                stakeholder.id,
                deliveryManagementTypes.NotificationType.NEW_CV_SHARED,
                {
                    candidateId: share.candidateId,
                    shareId: share.id,
                    recruiterId: share.recruiterId,
                    subject: '',
                    message: '',
                    clientId: share.clientId
                }
            );
        }
    }

    recordView(shareId: string, stakeholderId: string): void {
        const share = this.cvShares.get(shareId);
        if (!share) throw new Error('Share not found');

        const viewRecord: deliveryManagementTypes.ViewRecord = {
            stakeholderId,
            viewedAt: new Date(),
            duration: 0 // Will be updated when viewer closes the CV
        };

        share.viewHistory.push(viewRecord);
        share.status = deliveryManagementTypes.CVShareStatus.VIEWED;
    }


    getShareAnalytics(shareId: string): deliveryManagementTypes.ShareAnalytics {
        const share = this.cvShares.get(shareId);
        if (!share) throw new Error('Share not found');

        return {
            totalViews: share.viewHistory.length,
            uniqueViewers: new Set(share.viewHistory.map(v => v.stakeholderId)).size,
            averageViewDuration: this.calculateAverageViewDuration(share.viewHistory),
            stakeholderEngagement: this.calculateStakeholderEngagement(share),
            timeToFirstView: this.calculateTimeToFirstView(share),
            timeToFeedback: share.feedback ?
                this.calculateTimeToFeedback(share) : null
        };
    }

    private async getLatestCV(candidateId: string): Promise<deliveryManagementTypes.CV> {
        const cvs = this.candidateCVs.get(candidateId) || [];
        return cvs[cvs.length - 1];
    }

    private async customizeCV(cv: deliveryManagementTypes.CV, clientId: string, options: deliveryManagementTypes.CVCustomization): Promise<deliveryManagementTypes.CV> {
        // Apply customizations based on client preferences
        return {
            ...cv,
            id: generateUniqueId(),
            version: cv.version + 1,
            customizations: [...cv.customizations, options]
        };
    }

    // Analytics helper methods
    private calculateAverageViewDuration(viewHistory: deliveryManagementTypes.ViewRecord[]): number {
        if (viewHistory.length === 0) return 0;
        const totalDuration = viewHistory.reduce((sum, record) => sum + record.duration, 0);
        return totalDuration / viewHistory.length;
    }

    private calculateStakeholderEngagement(share: deliveryManagementTypes.CVShare): number {
        // Calculate engagement score based on views and feedback
        return 0; // Implementation details
    }

    private calculateTimeToFirstView(share: deliveryManagementTypes.CVShare): number {
        if (share.viewHistory.length === 0) return 0;
        const firstView = share.viewHistory[0];
        return firstView.viewedAt.getTime() - share.sharedAt.getTime();
    }

    private calculateTimeToFeedback(share: deliveryManagementTypes.CVShare): number {
        if (!share.feedback) return 0;
        return share.feedback.stakeholderId ?
            share.sharedAt.getTime() - new Date().getTime() : 0;
    }

    // private async updateCandidateStatus(candidateId: string, status: deliveryManagementTypes.CandidateStatus): Promise<void> {
    //     const candidate = this.candidates.get(candidateId);
    //     if (!candidate) throw new Error('Candidate not found');

    //     candidate.status = status;
    //     candidate.currentStage = this.createStageDetails(status);
    //     await this.notifyStatusChange(candidateId, status);
    // }

}

function generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
}





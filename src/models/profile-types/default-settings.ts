import { ProfileModel } from "../profile.model";

export function getDefaultProfileSettings(profileType: string): Record<string, any> {
    switch (profileType) {
      case 'personal':
        return {
          privacyLevel: 'private',
          allowContactSharing: true,
          journalingEnabled: false,
          emergencyContacts: [],
          sharedContentVisibility: 'followers',
        };
  
      case 'business':
        return {
          businessHours: { start: '09:00', end: '17:00' },
          location: '',
          services: [],
          teamMembers: [],
          externalTools: [],
          enableReviews: true,
          promotionsEnabled: false,
        };
  
      case 'academic':
        return {
          schoolName: '',
          certifications: [],
          showGPA: true,
          allowRecommendations: true,
          connectToScholarlyCommunities: true,
        };
  
      case 'professional':
        return {
          resumeUrl: '',
          portfolios: [],
          hourlyRate: 0,
          bookingEnabled: true,
          clientTestimonialsEnabled: true,
        };
  
      case 'sole_proprietor':
        return {
          businessContactVisible: true,
          serviceCategories: [],
          pricingModel: 'custom',
          branding: { logoUrl: '', themeColor: '#000000' },
          bookingMethod: 'manual',
          clientListVisible: true,
          taxVerified: false,
        };
  
      case 'freelancer':
        return {
          services: [],
          hourlyRate: 0,
          availabilityCalendarEnabled: true,
          quoteRequestsEnabled: true,
          preferredPaymentMethods: [],
          jobMatchingPreferences: [],
        };
  
      case 'artist':
        return {
          galleryUrls: [],
          artisticGenres: [],
          eventPromotionEnabled: true,
          fanInteractionEnabled: true,
          storeLink: '',
          allowTips: true,
        };
  
      case 'provider':
        return {
          servicesOffered: [],
          appointmentBookingEnabled: true,
          certifications: [],
          travelRadiusKm: 10,
          reviewHandling: 'manual',
          staffAssignmentEnabled: false,
        };
  
      case 'merchant':
        return {
          inventoryManagementEnabled: true,
          barcodeSupport: false,
          couponSystemEnabled: false,
          storeSyncPlatform: '',
          pickupOption: false,
          deliveryOption: true,
          salesReportsVisible: false,
          displayTaxInfo: true,
        };
  
      case 'vendor':
        return {
          eventParticipationList: [],
          serviceTags: [],
          boothBookingEnabled: true,
          certificationDocs: [],
          reviewEnabled: true,
          eventCalendarIntegration: true,
          leadTrackingEnabled: true,
        };
  
      case 'influencer':
        return {
          socialLinks: [],
          showFollowerCount: true,
          allowSponsorshipRequests: true,
          autoTagBrands: true,
          mediaKitUrl: '',
          showEngagementStats: true,
          showFollowersPublicly: true,
        };
  
      case 'emergency':
        return {
          bloodType: '',
          allergies: [],
          ICEContacts: [],
          allowQRPublicAccess: true,
          linkToMedicalID: false,
          allowEditBy: [],
        };
  
      case 'medical':
        return {
          medicalHistory: '',
          insuranceInfo: '',
          sensitiveDataPrivacyLevel: 'high',
          healthAlertsEnabled: true,
          linkToEmergencyProfile: true,
          practitionerViewOnly: true,
          consentToShare: true,
        };
  
      case 'pet':
        return {
          species: '',
          breed: '',
          vetInfo: '',
          vaccinationRecords: [],
          shareWith: [],
          lostAndFoundEnabled: false,
          petCareRoutines: '',
        };
  
      case 'ecommerce':
        return {
          storefrontUrl: '',
          allowOrders: true,
          returnPolicy: '',
          analyticsEnabled: true,
          notifyOnOrder: true,
          apiIntegrationEnabled: true,
        };
  
      case 'home':
        return {
          documents: [],
          householdMembers: [],
          accessControl: {
            guestCodeEnabled: false,
            NFCEnabled: false,
          },
          maintenanceRemindersEnabled: true,
          emergencyContacts: [],
          smartDeviceLinked: false,
        };
  
      case 'transportation':
        return {
          vehicles: [],
          routesVisible: true,
          schedule: [],
          maintenanceTrackingEnabled: true,
          tripLogsExportable: true,
          gpsEnabled: true,
          linkedDriverProfile: '',
        };
  
      case 'driver':
        return {
          licenseId: '',
          associatedVehicles: [],
          riderMessagingEnabled: true,
          emergencyProtocolEnabled: true,
          routePreferences: [],
          showRatings: true,
          linkedPaymentMethod: '',
        };
  
      case 'rider':
        return {
          defaultPaymentMethod: '',
          savedDestinations: [],
          emergencyAlertEnabled: true,
          showRating: true,
          rideHistoryVisible: true,
          driverPreferences: [],
          tipOptionEnabled: true,
        };
  
      case 'event':
        return {
          eventType: '',
          branding: {
            logoUrl: '',
            bannerUrl: '',
          },
          guestListEnabled: true,
          ticketingIntegrationEnabled: false,
          scheduleUrl: '',
          shareSettings: 'invite-only',
          host: '',
          sendReminders: true,
          liveUpdatesEnabled: true,
        };
  
      case 'dependent':
        return {
          guardians: [],
          viewEditPermissions: {
            academic: true,
            medical: true,
            schedule: false,
          },
          restrictionSettings: {
            screenTimeLimitHours: 2,
            restrictedContentTags: [],
          },
          shareAcademicInfo: true,
          shareMedicalInfo: true,
          activityAutoLog: true,
        };
  
      case 'group':
        return {
          logo: '',
          approvalRequired: true,
          postPermissions: 'admins-only',
          resourceSharingEnabled: true,
          taskAssignmentEnabled: false,
          goalTrackingEnabled: false,
          perMemberNotifications: true,
        };
  
      case 'team':
        return {
          roles: [],
          projectList: [],
          teamCalendarEnabled: true,
          progressSharing: true,
          teamChatEnabled: true,
          syncWithOrgProfile: false,
          shiftNotificationsEnabled: true,
        };
  
      case 'family':
        return {
          members: [],
          relationshipTags: {},
          sharedCalendarEnabled: true,
          emergencyToggle: true,
          groupChildrenAndPets: true,
          memoryBookEnabled: false,
          locationSharingEnabled: false,
        };
  
      case 'neighborhood':
        return {
          localServices: [],
          votingEnabled: true,
          crimeAlertsEnabled: true,
          memberApproval: 'verified',
          geolocationBoundary: '',
          moderatorRoles: [],
          localEventNotifications: true,
        };
  
      case 'company':
        return {
          legalName: '',
          logoUrl: '',
          taxId: '',
          branches: [],
          employeeManagementEnabled: true,
          crmIntegrationEnabled: true,
          hiringPortalEnabled: true,
          billingProfileId: '',
        };
  
      case 'association':
        return {
          memberDirectoryVisible: true,
          membershipLevels: [],
          visibility: 'private',
          eventsEnabled: true,
          adminStructure: [],
          autoInviteEnabled: false,
          paymentOptionsEnabled: true,
        };
  
      case 'organization':
        return {
          orgType: 'NGO',
          donationSettingsEnabled: true,
          volunteerToolsEnabled: true,
          projectTrackingEnabled: true,
          fileSharingEnabled: true,
          internalChatEnabled: false,
          taxDocs: [],
        };
  
      case 'institution':
        return {
          name: '',
          logo: '',
          accreditationDocs: [],
          departments: [],
          facultyRoles: [],
          visibility: 'restricted',
          autoApproveStudents: false,
          enableTranscriptUploads: true,
          academicCalendarLinked: true,
          eventRSVPEnabled: true,
          alumniDirectoryEnabled: false,
          courseList: [],
          applicationLinks: [],
          staffCommunication: false,
          analyticsEnabled: true,
          thirdPartySyncEnabled: true,
          scholarshipSectionsEnabled: false,
          policiesUploaded: [],
        };
  
      case 'community':
        return {
          addMembersPermission: 'admins',
          groupCreationPermission: 'moderators',
          memberRoles: [],
          chatEnabled: true,
          announcementPermissions: 'moderators',
          tagMentionPermission: true,
          replyEnabled: true,
          subgroupVisibility: 'moderated',
          joiningConditions: [],
          rsvpLimit: 100,
          searchVisibility: true,
          preModerationEnabled: false,
          keywordFilterList: [],
          autoFlagEnabled: false,
          muteBlockControls: true,
          pinnedRulesVisible: true,
          analyticsEnabled: true,
          QRInviteEnabled: true,
          allowCalendar: true,
          pollsEnabled: true,
          syncWithLinkedProfiles: [],
          appearance: {
            banner: '',
            colorTheme: '#000000',
            description: '',
          },
        };
  
      default:
        return {};
    }
  }

  export async function UpdateDefaultProfileSettings(profileId: string, settings: any) {
    const profile = await ProfileModel.findById(profileId);
    if (profile) {
      profile.specificSettings = settings;
      await profile.save();
    }
  }
  
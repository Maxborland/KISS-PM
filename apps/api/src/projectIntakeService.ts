import { activateProjectFromOpportunity } from "./projectIntakeService/activateProjectCommand";
import {
  authorizeOpportunityCreate,
  authorizeOpportunityStageChange,
  authorizeProjectActivation
} from "./projectIntakeService/authorization";
import { changeOpportunityStage } from "./projectIntakeService/changeOpportunityStageCommand";
import { checkOpportunityFeasibility } from "./projectIntakeService/checkOpportunityFeasibilityCommand";
import { createOpportunity } from "./projectIntakeService/createOpportunityCommand";
import { finalizeOpportunity } from "./projectIntakeService/finalizeOpportunityCommand";
import { authorizeOpportunityFinalize } from "./projectIntakeService/finalizeOpportunityAuthorization";
import { updateOpportunity } from "./projectIntakeService/updateOpportunityCommand";
import { authorizeOpportunityUpdate } from "./projectIntakeService/updateOpportunityAuthorization";
import type {
  ProjectIntakeService,
  ProjectIntakeServiceDeps
} from "./projectIntakeService/types";

export function createProjectIntakeService(
  deps: ProjectIntakeServiceDeps
): ProjectIntakeService {
  return {
    preflightCreateOpportunity(input) {
      return authorizeOpportunityCreate(deps, input.actor);
    },

    preflightChangeOpportunityStage(input) {
      return authorizeOpportunityStageChange(deps, input);
    },

    preflightUpdateOpportunity(input) {
      return authorizeOpportunityUpdate(deps, input);
    },

    preflightFinalizeOpportunity(input) {
      return authorizeOpportunityFinalize(deps, input);
    },

    preflightProjectActivation(input) {
      return authorizeProjectActivation(deps, input);
    },

    createOpportunity(input) {
      return createOpportunity(deps, input);
    },

    changeOpportunityStage(input) {
      return changeOpportunityStage(deps, input);
    },

    updateOpportunity(input) {
      return updateOpportunity(deps, input);
    },

    finalizeOpportunity(input) {
      return finalizeOpportunity(deps, input);
    },

    checkOpportunityFeasibility(input) {
      return checkOpportunityFeasibility(deps, input);
    },

    activateProjectFromOpportunity(input) {
      return activateProjectFromOpportunity(deps, input);
    }
  };
}

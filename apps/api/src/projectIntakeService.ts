import { activateProjectFromOpportunity } from "./projectIntakeService/activateProjectCommand";
import {
  authorizeOpportunityCreate,
  authorizeOpportunityStageChange,
  authorizeProjectActivation
} from "./projectIntakeService/authorization";
import { changeOpportunityStage } from "./projectIntakeService/changeOpportunityStageCommand";
import { checkOpportunityFeasibility } from "./projectIntakeService/checkOpportunityFeasibilityCommand";
import { createOpportunity } from "./projectIntakeService/createOpportunityCommand";
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

    preflightProjectActivation(input) {
      return authorizeProjectActivation(deps, input);
    },

    createOpportunity(input) {
      return createOpportunity(deps, input);
    },

    changeOpportunityStage(input) {
      return changeOpportunityStage(deps, input);
    },

    checkOpportunityFeasibility(input) {
      return checkOpportunityFeasibility(deps, input);
    },

    activateProjectFromOpportunity(input) {
      return activateProjectFromOpportunity(deps, input);
    }
  };
}

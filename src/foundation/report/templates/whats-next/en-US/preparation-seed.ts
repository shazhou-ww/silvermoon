/**
 * @template preparation-seed
 * @when idea.state=preparing
 * Used before idea acceptance to require lightweight downstream seeds.
 */
import type { PreparationSeedParameters } from "../contract.ts";

/** @pure */
const preparationSeed = ({
  deploymentDocumentPath,
  implementationDocumentPath,
  ledgerPath,
}: PreparationSeedParameters) =>
  [
    `Before requesting Idea acceptance, replace scaffold placeholders`,
    `with lightweight first versions in ${implementationDocumentPath}`,
    `and ${deploymentDocumentPath}, then mirror their stable IDs`,
    `and short titles in ${ledgerPath}.`,
    `Keep each downstream contract to no more than three high-level steps`,
    `and three observable criteria.`,
    `These provisional versions test feasibility but are outside the acceptIdeal decision.`,
  ].join(" ");

export default preparationSeed;

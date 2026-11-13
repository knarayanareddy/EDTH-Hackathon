import type { ReactNode } from "react";
import { SensorBridge } from "./SensorBridge";
import { BlindSpot } from "./BlindSpot";
import { Handover } from "./Handover";
import { SignalCheck } from "./SignalCheck";
import { CableWatch } from "./CableWatch";
import { AisIntegrity } from "./AisIntegrity";
import { SteadyThermal } from "./SteadyThermal";
import { ThermalLab } from "./ThermalLab";
import { SpatialDebrief } from "./SpatialDebrief";
import { GeoClick } from "./GeoClick";
import { OsintReadiness } from "./OsintReadiness";
import { IntentCompiler } from "./IntentCompiler";
import { GreyZoneQueue } from "./GreyZoneQueue";

export function renderPreview(slug: string): ReactNode {
  switch (slug) {
    case "sensorbridge":
      return <SensorBridge />;
    case "blindspot":
      return <BlindSpot />;
    case "handover":
      return <Handover />;
    case "signalcheck":
      return <SignalCheck />;
    case "cablewatch":
      return <CableWatch />;
    case "ais-integrity":
      return <AisIntegrity />;
    case "steadythermal":
      return <SteadyThermal />;
    case "thermallab":
      return <ThermalLab />;
    case "spatial-debrief":
      return <SpatialDebrief />;
    case "geoclick":
      return <GeoClick />;
    case "osint-readiness":
      return <OsintReadiness />;
    case "intent-compiler":
      return <IntentCompiler />;
    case "grey-zone-queue":
      return <GreyZoneQueue />;
    default:
      return null;
  }
}

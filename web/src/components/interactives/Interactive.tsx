"use client";

import type { Operation } from "@/lib/quantum";
import type { InteractiveType, PuzzleGate } from "@/lib/content/types";
import AmplitudeBars from "./AmplitudeBars";
import BellLab from "./BellLab";
import BitSwitches from "./BitSwitches";
import BlochSphere, { BlochSphereProps } from "./BlochSphere";
import CircuitSandbox from "./CircuitSandbox";
import CloningAttempt from "./CloningAttempt";
import CoinSampler from "./CoinSampler";
import MeasurementLab from "./MeasurementLab";
import TeleportLab from "./TeleportLab";

type Props = Record<string, unknown>;

/** Renders the interactive named in a concept's YAML with its `props`. */
export default function Interactive({
  type,
  props,
}: {
  type: InteractiveType;
  props: Props;
}) {
  switch (type) {
    case "bit_switches":
      return <BitSwitches />;
    case "coin_sampler":
      return <CoinSampler initial_p={props.initial_p as number | undefined} />;
    case "amplitude_bars":
      return <AmplitudeBars />;
    case "bloch_sphere":
      return <BlochSphere {...(props as BlochSphereProps)} />;
    case "measurement_lab":
      return (
        <MeasurementLab
          initial_theta={props.initial_theta as number | undefined}
        />
      );
    case "circuit_sandbox":
      return (
        <CircuitSandbox
          numQubits={(props.num_qubits as number) ?? 1}
          allowedGates={(props.allowed_gates as PuzzleGate[]) ?? ["X", "H"]}
          initialOps={(props.initial_ops as Operation[]) ?? []}
          showBloch={Boolean(props.show_bloch)}
        />
      );
    case "bell_lab":
      return (
        <BellLab
          mode={props.mode as "correlations" | "no_signal" | undefined}
        />
      );
    case "cloning_attempt":
      return <CloningAttempt />;
    case "teleport_lab":
      return <TeleportLab mode="guided" />;
  }
}

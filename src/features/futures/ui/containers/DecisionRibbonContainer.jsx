import React from 'react';
import { useSignalStore, selectDecisionTapeBySymbol } from '../../application/stores/signalStore';
import ScalpingDecisionRibbon from '../components/ScalpingDecisionRibbon';

export default function DecisionRibbonContainer({ symbol }) {
  const decisionTape = useSignalStore(selectDecisionTapeBySymbol(symbol));

  return (
    <ScalpingDecisionRibbon
      decisionTape={decisionTape}
    />
  );
}

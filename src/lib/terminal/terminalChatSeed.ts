import type { ChatMsg } from './terminalTypes';

export function buildInitialTerminalChatMessages(): ChatMsg[] {
  return [
    {
      from: 'SYSTEM',
      icon: '🤖',
      color: '#E8967D',
      text: 'Stockclaw Orchestrator v8 online. 8 agents standing by. Scan first, then ask questions about the results.',
      time: '—',
      isUser: false,
      isSystem: true,
    },
    {
      from: 'ORCHESTRATOR',
      icon: '🧠',
      color: '#ff2d9b',
      text:
        '💡 Try these:\n' +
        '• "BTC 전망 분석해줘" — I\'ll route to the right agents\n' +
        '• "차트패턴 찾아봐" — 보이는 구간 패턴을 차트에 바로 표시\n' +
        '• "@STRUCTURE MA, RSI 분석" — Direct to Structure agent\n' +
        '• "@DERIV 펀딩 + OI 어때?" — Derivatives analysis\n' +
        '• "@FLOW 고래 움직임?" — On-chain + whale flow\n' +
        '• "@SENTI 소셜 센티먼트" — F&G + LunarCrush social\n' +
        '• "@MACRO DXY, 금리 영향?" — Macro regime check',
      time: '—',
      isUser: false,
    },
  ];
}

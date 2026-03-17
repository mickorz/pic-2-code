import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Clock3, TerminalSquare } from 'lucide-react';

export interface ProcessingLogItem {
  id: string;
  ts: string;
  source: 'ui' | 'gateway';
  level: 'info' | 'success' | 'error';
  title: string;
  detail?: string;
  stage?: string;
}

interface ProcessingLogPanelProps {
  logs: ProcessingLogItem[];
  requestId?: string | null;
  isRunning: boolean;
  elapsedSeconds: number;
}

const ProcessingLogPanel: React.FC<ProcessingLogPanelProps> = ({
  logs,
  requestId,
  isRunning,
  elapsedSeconds,
}) => {
  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;

  const currentStageLabel = useMemo(() => {
    switch (latestLog?.stage) {
      case 'prepare':
        return '准备请求';
      case 'prepare_input':
        return '准备输入';
      case 'build_prompt':
        return '构建提示词';
      case 'launch_cli':
        return '启动 CLI';
      case 'session':
        return '建立会话';
      case 'reasoning':
        return '分析布局';
      case 'generation':
        return '生成代码';
      case 'tooling':
        return '内部步骤';
      case 'read_output':
        return '读取输出';
      case 'normalize_output':
        return '整理结果';
      case 'finalize':
        return '处理完成';
      default:
        return latestLog ? '处理中' : '等待开始';
    }
  }, [latestLog]);

  const getStageLabel = (stage?: string) => {
    switch (stage) {
      case 'prepare':
        return '准备';
      case 'prepare_input':
        return '输入';
      case 'build_prompt':
        return '提示词';
      case 'launch_cli':
        return '启动';
      case 'session':
        return '会话';
      case 'reasoning':
        return '分析';
      case 'generation':
        return '生成';
      case 'tooling':
        return '步骤';
      case 'read_output':
        return '读取';
      case 'normalize_output':
        return '整理';
      case 'finalize':
        return '完成';
      default:
        return '阶段';
    }
  };

  const getLevelStyle = (level: ProcessingLogItem['level'], isLatest: boolean) => {
    const latestStyle = isLatest ? 'ring-1 ring-cyan-400/50 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]' : '';

    if (level === 'success') {
      return `border-emerald-500/20 bg-emerald-500/10 text-emerald-100 ${latestStyle}`;
    }

    if (level === 'error') {
      return `border-red-500/20 bg-red-500/10 text-red-100 ${latestStyle}`;
    }

    return `border-indigo-500/20 bg-indigo-500/10 text-indigo-100 ${latestStyle}`;
  };

  const getLevelIcon = (level: ProcessingLogItem['level']) => {
    if (level === 'success') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-300" />;
    }

    if (level === 'error') {
      return <AlertCircle className="w-4 h-4 text-red-300" />;
    }

    return <Clock3 className="w-4 h-4 text-indigo-300" />;
  };

  return (
    <section
      className="h-full min-h-[500px] flex flex-col rounded-xl border border-gray-800 bg-[#11161d] shadow-2xl overflow-hidden"
      aria-label="Processing Logs"
    >
      <div className="px-4 py-3 border-b border-gray-800 bg-[#161b22]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-100">
            <TerminalSquare className="w-4 h-4 text-cyan-300" />
            <h3 className="text-sm font-semibold">处理日志</h3>
          </div>
          <div className={`text-xs px-2 py-1 rounded-full border ${
            isRunning
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
              : 'border-gray-700 bg-gray-800 text-gray-400'
          }`}>
            {isRunning ? `运行中 ${elapsedSeconds}s` : '空闲'}
          </div>
        </div>

        {requestId && (
          <div className="mt-2 text-[11px] text-gray-400 break-all">
            Request ID: {requestId}
          </div>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2 text-gray-300">
            <div className="text-gray-500">日志条数</div>
            <div className="mt-1 text-sm font-semibold text-white">{logs.length}</div>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2 text-gray-300">
            <div className="text-gray-500">当前状态</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {isRunning ? '处理中' : '已结束'}
            </div>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-cyan-100">
            <div className="text-cyan-300/70">当前阶段</div>
            <div className="mt-1 text-sm font-semibold">{currentStageLabel}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-500 text-center px-4">
            这里会实时显示前端步骤和本地网关处理阶段。
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/50 via-indigo-500/30 to-transparent" />
            <div className="space-y-4">
              {logs.map((log, index) => {
                const isLatest = index === logs.length - 1;

                return (
                  <div key={log.id} className="relative pl-8">
                    <div className={`absolute left-0 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-gray-800 bg-[#0f141b] shadow-lg ${isLatest ? 'ring-2 ring-cyan-400/40' : ''}`}>
                      {getLevelIcon(log.level)}
                    </div>
                    <div className={`rounded-xl border px-3 py-3 shadow-sm transition-all ${getLevelStyle(log.level, isLatest)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium">{log.title}</div>
                            <span className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                              {log.source === 'ui' ? 'UI' : 'Gateway'}
                            </span>
                            {log.stage && (
                              <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px]">
                                {getStageLabel(log.stage)}
                              </span>
                            )}
                            {isLatest && (
                              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">
                                最新
                              </span>
                            )}
                          </div>
                          {log.detail && (
                            <div className="mt-2 text-xs leading-5 whitespace-pre-wrap break-words opacity-90">
                              {log.detail}
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] opacity-70 whitespace-nowrap">
                          {new Date(log.ts).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProcessingLogPanel;

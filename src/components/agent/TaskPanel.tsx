"use client";

import { Task, TaskPlan } from "@/lib/agent/types";
import { CheckCircle2, Circle, Loader2, XCircle, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TaskPanelProps {
  plan?: TaskPlan;
  tasks?: Task[];
  className?: string;
}

export function TaskPanel({ plan, tasks: tasksProp, className }: TaskPanelProps) {
  const tasks = plan?.tasks || tasksProp || [];
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  if (tasks.length === 0) return null;

  const toggleTask = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />;
      case 'pending':
        return <Circle className="w-4 h-4 text-gray-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      default:
        return <Circle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-400';
      case 'in_progress':
        return 'text-violet-400';
      case 'pending':
        return 'text-gray-400';
      case 'failed':
        return 'text-red-400';
      case 'skipped':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className={cn("space-y-2 p-4 bg-white/5 rounded-lg border border-white/10", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">
          {plan ? 'Task Plan' : 'Tasks'}
        </h3>
        {plan && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">
              {plan.completedTasks}/{plan.totalTasks}
            </span>
            <div className={cn(
              "px-2 py-0.5 rounded text-xs font-medium",
              plan.status === 'completed' && "bg-emerald-500/20 text-emerald-300",
              plan.status === 'executing' && "bg-violet-500/20 text-violet-300",
              plan.status === 'failed' && "bg-red-500/20 text-red-300",
              plan.status === 'planning' && "bg-blue-500/20 text-blue-300"
            )}>
              {plan.status}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {plan && (
        <div className="w-full bg-white/10 rounded-full h-1.5 mb-3">
          <div
            className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${(plan.completedTasks / plan.totalTasks) * 100}%` }}
          />
        </div>
      )}

      {/* Tasks */}
      <div className="space-y-1">
        {tasks.map((task, idx) => (
          <TaskItem
            key={task.id}
            task={task}
            index={idx}
            isExpanded={expandedTasks.has(task.id)}
            onToggle={() => toggleTask(task.id)}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
          />
        ))}
      </div>
    </div>
  );
}

interface TaskItemProps {
  task: Task;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  getStatusIcon: (status: Task['status']) => React.ReactNode;
  getStatusColor: (status: Task['status']) => string;
  depth?: number;
}

function TaskItem({
  task,
  index,
  isExpanded,
  onToggle,
  getStatusIcon,
  getStatusColor,
  depth = 0,
}: TaskItemProps) {
  const hasDetails = task.error || task.result || (task.subtasks && task.subtasks.length > 0);

  return (
    <div className={cn("", depth > 0 && "ml-4")}>
      <div
        className={cn(
          "flex items-start gap-3 p-2 rounded-md transition-colors",
          hasDetails && "cursor-pointer hover:bg-white/5"
        )}
        onClick={hasDetails ? onToggle : undefined}
      >
        {/* Expand Icon */}
        <div className="shrink-0 w-4 flex items-center justify-center">
          {hasDetails ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-white/40" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-white/40" />
            )
          ) : (
            <div className="w-3.5" />
          )}
        </div>

        {/* Status Icon */}
        <div className="shrink-0 mt-0.5">
          {getStatusIcon(task.status)}
        </div>

        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-white flex-1">
              {depth === 0 && <span className="text-white/40 mr-2">{index + 1}.</span>}
              {task.description}
            </p>
            {task.endTime && task.startTime && (
              <span className="text-xs text-white/40 shrink-0">
                {((task.endTime - task.startTime) / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            {task.tool && (
              <span className="text-xs text-white/60 font-mono">
                {task.tool}
              </span>
            )}
            {task.dependencies && task.dependencies.length > 0 && (
              <span className="text-xs text-white/40">
                ← depends on {task.dependencies.join(', ')}
              </span>
            )}
            {task.retries && task.retries > 0 && (
              <span className="text-xs text-yellow-400">
                (retry {task.retries})
              </span>
            )}
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-2 space-y-2">
              {/* Error */}
              {task.error && (
                <div className="text-xs text-red-300 bg-red-500/10 rounded px-2 py-1 border border-red-500/20">
                  <span className="font-semibold">Error:</span> {task.error}
                </div>
              )}

              {/* Result */}
              {task.result && (
                <div className="text-xs text-white/70 bg-white/5 rounded px-2 py-1 border border-white/10">
                  <span className="font-semibold text-white/90">Result:</span>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">
                    {typeof task.result === 'string'
                      ? task.result.slice(0, 200)
                      : JSON.stringify(task.result, null, 2).slice(0, 200)}
                  </pre>
                </div>
              )}

              {/* Arguments */}
              {task.args && Object.keys(task.args).length > 0 && (
                <div className="text-xs text-white/60 bg-white/5 rounded px-2 py-1 border border-white/10">
                  <span className="font-semibold">Args:</span>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">
                    {JSON.stringify(task.args, null, 2).slice(0, 150)}
                  </pre>
                </div>
              )}

              {/* Subtasks */}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="space-y-1 mt-2">
                  {task.subtasks.map((subtask, idx) => (
                    <TaskItem
                      key={subtask.id}
                      task={subtask}
                      index={idx}
                      isExpanded={false}
                      onToggle={() => {}}
                      getStatusIcon={getStatusIcon}
                      getStatusColor={getStatusColor}
                      depth={depth + 1}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Logging utilities using OpenTelemetry and Sentry
 * These functions create proper traces, spans, and events for debugging
 * across all environments with appropriate sampling.
 */

import { trace } from '@opentelemetry/api'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Create a log event using OpenTelemetry spans and events
 */
const createLogEvent = (
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
): void => {
  // Get caller information automatically
  const stack = new Error().stack
  const callerLine = stack?.split('\n')[3] // Skip createLogEvent, logging method, and Error()

  let fileName = 'unknown'
  let functionName = 'unknown'

  if (callerLine ?? '') {
    // Extract file name from stack trace
    const fileMatch = callerLine?.match(/\/([^/]+\.tsx?)/)
    if (fileMatch) {
      fileName =
        fileMatch[1]?.replace(/\.(ts|tsx)$/, '') ?? callerLine ?? 'unknown'
    }

    // Extract function name from stack trace
    const functionMatch = callerLine?.match(/at (\w+)/)
    if (functionMatch) {
      functionName = functionMatch[1] ?? 'unknown'
    }
  }

  const tracer = trace.getTracer('macroflows')

  // Use the current active span if available, otherwise create a new one
  const activeSpan = trace.getActiveSpan()

  console.debug(`log.${level}`, {
    'log.body': message,
    'log.severity': level,
    'code.filepath': fileName,
    'code.function': functionName,
    timestamp: Date.now(),
    ...data,
  })

  if (activeSpan) {
    // Add event to existing active span (nested logging)
    activeSpan.addEvent(`log.${level}`, {
      'log.body': message,
      'log.severity': level,
      'code.filepath': fileName,
      'code.function': functionName,
      timestamp: Date.now(),
      ...data,
    })
  } else {
    // Create a new span if no active context
    const span = tracer.startSpan(`${fileName}.${functionName}`, {
      attributes: {
        'code.filepath': fileName,
        'code.function': functionName,
        'log.severity': level,
      },
    })

    try {
      span.addEvent(`log.${level}`, {
        'log.body': message,
        'log.severity': level,
        timestamp: Date.now(),
        ...data,
      })
    } finally {
      span.end()
    }
  }
}

/**
 * Logging utilities using OpenTelemetry patterns
 */
export const logging = {
  /**
   * Debug-level logging with automatic context
   */
  debug: (message: string, data?: Record<string, unknown>): void => {
    createLogEvent('debug', message, data)
  },

  /**
   * Info-level logging with automatic context
   */
  info: (message: string, data?: Record<string, unknown>): void => {
    createLogEvent('info', message, data)
  },

  /**
   * Warning-level logging with automatic context
   */
  warn: (message: string, data?: Record<string, unknown>): void => {
    createLogEvent('warn', message, data)
  },

  /**
   * Error-level logging with automatic context
   * Also sends to Sentry for error tracking
   */
  error: (
    message: string,
    error?: unknown,
    data?: Record<string, unknown>,
  ): void => {
    console.error(message, error, data)
    createLogEvent('error', message, {
      error: error instanceof Error ? error.message : error,
      ...data,
    })
  },
}

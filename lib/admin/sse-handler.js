/**
 * Server-Sent Events (SSE) Handler for Admin Portal
 * Provides real-time updates for admin dashboard
 */

// Store active SSE connections
const connections = new Map();

// Event types
const EVENT_TYPES = {
  ACTIVITY: 'activity',
  METRICS: 'metrics',
  USER_UPDATE: 'user_update',
  SUBSCRIPTION_UPDATE: 'subscription_update',
  PAYMENT_UPDATE: 'payment_update',
  SYSTEM_ALERT: 'system_alert'
};

/**
 * Initialize SSE connection for admin user
 */
function initializeSSE(req, res) {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable nginx buffering
  });

  // Store connection
  const adminEmail = req.adminUser.email;
  const connectionId = `${adminEmail}-${Date.now()}`;

  const connection = {
    id: connectionId,
    adminEmail,
    res,
    createdAt: new Date()
  };

  connections.set(connectionId, connection);

  console.log(`SSE connection established: ${connectionId} (${adminEmail})`);

  // Send initial connection message
  sendEvent(connectionId, {
    type: 'connected',
    message: 'Connected to admin event stream',
    timestamp: new Date().toISOString()
  });

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    if (connections.has(connectionId)) {
      sendEvent(connectionId, { type: 'heartbeat' });
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Clean up on connection close
  req.on('close', () => {
    clearInterval(heartbeat);
    connections.delete(connectionId);
    console.log(`SSE connection closed: ${connectionId}`);
  });
}

/**
 * Send event to specific connection
 */
function sendEvent(connectionId, data, eventType = null) {
  const connection = connections.get(connectionId);
  if (!connection) return false;

  try {
    let message = '';

    if (eventType) {
      message += `event: ${eventType}\n`;
    }

    message += `data: ${JSON.stringify(data)}\n\n`;

    connection.res.write(message);
    return true;
  } catch (error) {
    console.error(`Failed to send SSE event to ${connectionId}:`, error);
    connections.delete(connectionId);
    return false;
  }
}

/**
 * Broadcast event to all connected admins
 */
function broadcastEvent(data, eventType = null, filterAdminEmail = null) {
  let sentCount = 0;

  for (const [connectionId, connection] of connections.entries()) {
    // Skip if filtering by admin email and doesn't match
    if (filterAdminEmail && connection.adminEmail !== filterAdminEmail) {
      continue;
    }

    if (sendEvent(connectionId, data, eventType)) {
      sentCount++;
    }
  }

  return sentCount;
}

/**
 * Send activity update to all admins
 */
function broadcastActivity(activity) {
  return broadcastEvent(activity, EVENT_TYPES.ACTIVITY);
}

/**
 * Send metrics update to all admins
 */
function broadcastMetrics(metrics) {
  return broadcastEvent(metrics, EVENT_TYPES.METRICS);
}

/**
 * Send user update to all admins
 */
function broadcastUserUpdate(userData) {
  return broadcastEvent(userData, EVENT_TYPES.USER_UPDATE);
}

/**
 * Send subscription update to all admins
 */
function broadcastSubscriptionUpdate(subscriptionData) {
  return broadcastEvent(subscriptionData, EVENT_TYPES.SUBSCRIPTION_UPDATE);
}

/**
 * Send payment update to all admins
 */
function broadcastPaymentUpdate(paymentData) {
  return broadcastEvent(paymentData, EVENT_TYPES.PAYMENT_UPDATE);
}

/**
 * Send system alert to all admins
 */
function broadcastSystemAlert(alert) {
  return broadcastEvent(alert, EVENT_TYPES.SYSTEM_ALERT);
}

/**
 * Get active connection count
 */
function getConnectionCount() {
  return connections.size;
}

/**
 * Get all active connections info
 */
function getActiveConnections() {
  return Array.from(connections.values()).map(conn => ({
    id: conn.id,
    adminEmail: conn.adminEmail,
    createdAt: conn.createdAt,
    duration: Math.floor((Date.now() - conn.createdAt.getTime()) / 1000)
  }));
}

/**
 * Close all connections (for graceful shutdown)
 */
function closeAllConnections() {
  console.log(`Closing ${connections.size} SSE connections...`);

  for (const [connectionId, connection] of connections.entries()) {
    try {
      sendEvent(connectionId, {
        type: 'shutdown',
        message: 'Server is shutting down'
      });

      connection.res.end();
    } catch (error) {
      console.error(`Error closing connection ${connectionId}:`, error);
    }
  }

  connections.clear();
}

// Graceful shutdown handler
process.on('SIGTERM', closeAllConnections);
process.on('SIGINT', closeAllConnections);

module.exports = {
  initializeSSE,
  sendEvent,
  broadcastEvent,
  broadcastActivity,
  broadcastMetrics,
  broadcastUserUpdate,
  broadcastSubscriptionUpdate,
  broadcastPaymentUpdate,
  broadcastSystemAlert,
  getConnectionCount,
  getActiveConnections,
  closeAllConnections,
  EVENT_TYPES
};

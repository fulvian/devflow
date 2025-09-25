import React, { useState, useEffect } from 'react';
import { AnalyticsService } from '../services/critical-issues/analytics-service';
import { DashboardData } from '../services/critical-issues/dashboard-data';
import { CriticalIssue } from '../types/critical-issues';

interface CriticalIssuesDashboardProps {
  issues: CriticalIssue[];
}

const CriticalIssuesDashboard: React.FC<CriticalIssuesDashboardProps> = ({ issues }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const analyticsService = new AnalyticsService();
    
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const data = await analyticsService.generateDashboardData(issues);
        setDashboardData(data);
        setError(null);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadDashboardData();
  }, [issues]);

  const handleExportReport = async () => {
    if (!dashboardData) return;
    
    const analyticsService = new AnalyticsService();
    const blob = await analyticsService.exportReport(dashboardData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `critical-issues-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="dashboard">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="dashboard error">Error: {error}</div>;
  }

  if (!dashboardData) {
    return <div className="dashboard">No data available</div>;
  }

  return (
    <div className="critical-issues-dashboard">
      <div className="dashboard-header">
        <h1>Critical Issues Dashboard</h1>
        <div className="dashboard-actions">
          <button onClick={handleExportReport} className="export-button">
            Export Report
          </button>
          <span className="last-updated">
            Last updated: {dashboardData.lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Compliance Status */}
      <div className="compliance-status">
        <h2>Context7 Compliance</h2>
        <div className={`status-indicator ${dashboardData.validationResults.isValid ? 'valid' : 'invalid'}`}>
          {dashboardData.validationResults.isValid ? 'Compliant' : 'Non-Compliant'}
        </div>
        {!dashboardData.validationResults.isValid && (
          <div className="validation-errors">
            <h3>Validation Errors:</h3>
            <ul>
              {dashboardData.validationResults.errors.map((error, index) => (
                <li key={index}>
                  Issue {error.issueId}: {error.field} - {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Issues</h3>
          <div className="metric-value">{dashboardData.metrics.totalIssues}</div>
        </div>
        <div className="metric-card">
          <h3>Resolved</h3>
          <div className="metric-value">{dashboardData.metrics.resolvedIssues}</div>
        </div>
        <div className="metric-card">
          <h3>Critical</h3>
          <div className="metric-value">{dashboardData.metrics.criticalIssues}</div>
        </div>
        <div className="metric-card">
          <h3>Avg. Resolution Time</h3>
          <div className="metric-value">{dashboardData.metrics.avgResolutionTime.toFixed(1)}h</div>
        </div>
        <div className="metric-card">
          <h3>Resolution Rate</h3>
          <div className="metric-value">{dashboardData.metrics.resolutionRate.toFixed(1)}%</div>
        </div>
        <div className="metric-card">
          <h3>Team Efficiency</h3>
          <div className="metric-value">{dashboardData.metrics.teamEfficiency.toFixed(1)}%</div>
        </div>
      </div>

      {/* Trend Visualization */}
      <div className="trend-section">
        <h2>Issue Trends</h2>
        <div className="trend-chart">
          {dashboardData.trendData.map((point, index) => (
            <div key={index} className="trend-bar" style={{
              height: `${Math.min(point.count * 10, 100)}px`
            }}>
              <div className="trend-date">{point.date}</div>
              <div className="trend-values">
                <span className="total">{point.count}</span>
                <span className="resolved">{point.resolved}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prioritized Issues */}
      <div className="prioritized-issues">
        <h2>Prioritized Issues</h2>
        <table className="issues-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.prioritizedIssues.slice(0, 10).map(issue => (
              <tr key={issue.id}>
                <td>{issue.title}</td>
                <td className={`severity-${issue.severity}`}>
                  {issue.severity}
                </td>
                <td className={`priority-${issue.priority}`}>
                  {issue.priority}
                </td>
                <td className={`status-${issue.status}`}>
                  {issue.status}
                </td>
                <td>{issue.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recommendations */}
      <div className="recommendations">
        <h2>Recommendations</h2>
        <ul>
          {dashboardData.prioritizedIssues.length > 0 && (
            <li>Focus on the top {Math.min(5, dashboardData.prioritizedIssues.length)} prioritized issues</li>
          )}
          {dashboardData.metrics.criticalIssues > 0 && (
            <li>Address {dashboardData.metrics.criticalIssues} critical issues immediately</li>
          )}
          {dashboardData.metrics.avgResolutionTime > 48 && (
            <li>Improve resolution time - current average is {dashboardData.metrics.avgResolutionTime.toFixed(1)} hours</li>
          )}
        </ul>
      </div>

      <style jsx>{`
        .critical-issues-dashboard {
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        
        .dashboard-actions {
          display: flex;
          gap: 15px;
          align-items: center;
        }
        
        .export-button {
          background: #0070f3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .last-updated {
          color: #666;
          font-size: 14px;
        }
        
        .compliance-status {
          margin-bottom: 30px;
          padding: 20px;
          border-radius: 8px;
          background: #f5f5f5;
        }
        
        .status-indicator {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: bold;
          margin: 10px 0;
        }
        
        .status-indicator.valid {
          background: #d4edda;
          color: #155724;
        }
        
        .status-indicator.invalid {
          background: #f8d7da;
          color: #721c24;
        }
        
        .validation-errors {
          margin-top: 15px;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .metric-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          text-align: center;
        }
        
        .metric-value {
          font-size: 24px;
          font-weight: bold;
          margin-top: 10px;
          color: #0070f3;
        }
        
        .trend-section {
          margin-bottom: 30px;
        }
        
        .trend-chart {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 20px 0;
        }
        
        .trend-bar {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 60px;
          background: #e3f2fd;
          border-radius: 4px;
          position: relative;
        }
        
        .trend-date {
          font-size: 12px;
          padding: 5px;
        }
        
        .trend-values {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 5px;
        }
        
        .total {
          font-weight: bold;
        }
        
        .resolved {
          color: #4caf50;
          font-size: 12px;
        }
        
        .prioritized-issues {
          margin-bottom: 30px;
        }
        
        .issues-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .issues-table th,
        .issues-table td {
          padding: 12px 15px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        
        .issues-table th {
          background: #f5f5f5;
          font-weight: 600;
        }
        
        .severity-critical, .priority-critical {
          color: #d32f2f;
          font-weight: bold;
        }
        
        .severity-high, .priority-high {
          color: #f57c00;
        }
        
        .severity-medium, .priority-medium {
          color: #fbc02d;
        }
        
        .severity-low, .priority-low {
          color: #388e3c;
        }
        
        .status-resolved {
          color: #388e3c;
        }
        
        .status-open {
          color: #d32f2f;
        }
        
        .status-in-progress {
          color: #f57c00;
        }
        
        .recommendations ul {
          padding-left: 20px;
        }
        
        .recommendations li {
          margin-bottom: 10px;
        }
      `}</style>
    </div>
  );
};

export default CriticalIssuesDashboard;

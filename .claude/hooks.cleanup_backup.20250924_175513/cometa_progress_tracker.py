#!/usr/bin/env python3
"""
Cometa Brain Task Progress Tracking Interface
Real-time monitoring and reporting of task progress with natural language summaries
"""

import json
import sys
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict

DB_PATH = Path('./data/devflow_unified.sqlite')

class TaskProgressTracker:
    """Tracks and reports task progress with intelligent insights"""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def get_progress_summary(self, timeframe: str = 'today') -> Dict[str, Any]:
        """
        Get comprehensive progress summary with natural language insights

        Args:
            timeframe: 'today', 'week', 'month', or 'all'

        Returns:
            Progress summary with insights and recommendations
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Calculate time boundaries
            time_filter = self._get_time_filter(timeframe)

            # Get core metrics
            metrics = self._calculate_metrics(cursor, time_filter)

            # Get progress insights
            insights = self._generate_insights(cursor, metrics, time_filter)

            # Get recommendations
            recommendations = self._generate_recommendations(cursor, metrics)

            # Get trend analysis
            trends = self._analyze_trends(cursor, timeframe)

            summary = {
                'timeframe': timeframe,
                'generated_at': datetime.now().isoformat(),
                'metrics': metrics,
                'insights': insights,
                'recommendations': recommendations,
                'trends': trends,
                'natural_language_summary': self._create_nl_summary(metrics, insights, trends)
            }

            return {
                'success': True,
                'data': summary
            }

        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to generate progress summary: {str(e)}"
            }
        finally:
            conn.close()

    def track_task_activity(self, task_id: int) -> Dict[str, Any]:
        """Track activity and progress for a specific task"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Get task details
            cursor.execute("SELECT * FROM task_contexts WHERE id = ?", (task_id,))
            task = cursor.fetchone()

            if not task:
                return {
                    'success': False,
                    'error': f"Task {task_id} not found"
                }

            columns = [description[0] for description in cursor.description]
            task_dict = dict(zip(columns, task))

            # Get activity history from memory stream
            cursor.execute("""
                SELECT event_type, significance_score, context_data, created_at
                FROM cometa_memory_stream
                WHERE context_data LIKE ?
                ORDER BY created_at DESC
                LIMIT 20
            """, (f"%{task_id}%",))

            activities = []
            for event in cursor.fetchall():
                activities.append({
                    'event_type': event[0],
                    'significance': event[1],
                    'context': json.loads(event[2]) if event[2] else {},
                    'timestamp': event[3]
                })

            # Calculate task metrics
            task_metrics = self._calculate_task_metrics(cursor, task_id, task_dict)

            # Generate task insights
            task_insights = self._generate_task_insights(task_dict, activities, task_metrics)

            return {
                'success': True,
                'data': {
                    'task': task_dict,
                    'metrics': task_metrics,
                    'activities': activities,
                    'insights': task_insights,
                    'progress_summary': self._create_task_nl_summary(task_dict, task_metrics, task_insights)
                }
            }

        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to track task activity: {str(e)}"
            }
        finally:
            conn.close()

    def get_productivity_insights(self, user_id: str = 'claude_user') -> Dict[str, Any]:
        """Generate productivity insights and patterns"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            insights = {}

            # Task completion patterns
            insights['completion_patterns'] = self._analyze_completion_patterns(cursor, user_id)

            # Time-based productivity
            insights['time_patterns'] = self._analyze_time_patterns(cursor, user_id)

            # Complexity vs completion rate
            insights['complexity_analysis'] = self._analyze_complexity_patterns(cursor)

            # Priority effectiveness
            insights['priority_effectiveness'] = self._analyze_priority_effectiveness(cursor)

            # Productivity score
            insights['productivity_score'] = self._calculate_productivity_score(insights)

            return {
                'success': True,
                'data': {
                    'user_id': user_id,
                    'insights': insights,
                    'generated_at': datetime.now().isoformat(),
                    'summary': self._create_productivity_summary(insights)
                }
            }

        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to generate productivity insights: {str(e)}"
            }
        finally:
            conn.close()

    def _get_time_filter(self, timeframe: str) -> Dict[str, Any]:
        """Generate time filter for queries"""
        now = datetime.now()

        if timeframe == 'today':
            start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif timeframe == 'week':
            start_time = now - timedelta(days=7)
        elif timeframe == 'month':
            start_time = now - timedelta(days=30)
        else:  # 'all'
            start_time = datetime.min

        return {
            'start_time': start_time.isoformat(),
            'end_time': now.isoformat(),
            'timeframe': timeframe
        }

    def _calculate_metrics(self, cursor, time_filter: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate core progress metrics"""
        metrics = {}

        # Task counts by status
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM task_contexts
            WHERE updated_at >= ?
            GROUP BY status
        """, (time_filter['start_time'],))

        status_counts = dict(cursor.fetchall())
        metrics['task_counts'] = status_counts

        # Total tasks
        total_tasks = sum(status_counts.values())
        metrics['total_tasks'] = total_tasks

        # Completion rate
        completed = status_counts.get('completed', 0)
        metrics['completion_rate'] = (completed / total_tasks) if total_tasks > 0 else 0

        # Priority distribution
        cursor.execute("""
            SELECT priority, COUNT(*) as count
            FROM task_contexts
            WHERE updated_at >= ?
            GROUP BY priority
        """, (time_filter['start_time'],))

        metrics['priority_distribution'] = dict(cursor.fetchall())

        # Average complexity
        cursor.execute("""
            SELECT AVG(complexity_score) as avg_complexity
            FROM task_contexts
            WHERE updated_at >= ?
            AND complexity_score IS NOT NULL
        """, (time_filter['start_time'],))

        avg_complexity = cursor.fetchone()[0]
        metrics['average_complexity'] = avg_complexity or 0

        # Memory events count
        cursor.execute("""
            SELECT COUNT(*) as event_count
            FROM cometa_memory_stream
            WHERE created_at >= ?
        """, (time_filter['start_time'],))

        metrics['memory_events'] = cursor.fetchone()[0]

        return metrics

    def _generate_insights(self, cursor, metrics: Dict[str, Any], time_filter: Dict[str, Any]) -> List[str]:
        """Generate natural language insights from metrics"""
        insights = []

        # Completion rate insights
        completion_rate = metrics['completion_rate']
        if completion_rate > 0.8:
            insights.append("🎯 Excellent completion rate! You're highly productive.")
        elif completion_rate > 0.6:
            insights.append("👍 Good completion rate. Keep up the momentum!")
        elif completion_rate > 0.3:
            insights.append("⚠️ Moderate completion rate. Consider task prioritization.")
        else:
            insights.append("🔍 Low completion rate. Focus on smaller, achievable tasks.")

        # Task volume insights
        total_tasks = metrics['total_tasks']
        if total_tasks > 20:
            insights.append("📊 High task volume detected. Consider breaking down complex tasks.")
        elif total_tasks == 0:
            insights.append("🆕 No tasks in this timeframe. Ready for new challenges!")

        # Priority insights
        priority_dist = metrics['priority_distribution']
        high_priority = priority_dist.get('h-', 0)
        if high_priority > total_tasks * 0.5:
            insights.append("🚨 Many high-priority tasks. Focus on urgent items first.")

        # Complexity insights
        avg_complexity = metrics['average_complexity']
        if avg_complexity > 7:
            insights.append("🧠 Working on complex tasks. Ensure adequate time allocation.")
        elif avg_complexity < 3:
            insights.append("⚡ Tasks are relatively simple. Good opportunity to build momentum.")

        return insights

    def _generate_recommendations(self, cursor, metrics: Dict[str, Any]) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []

        completion_rate = metrics['completion_rate']
        total_tasks = metrics['total_tasks']

        if completion_rate < 0.5 and total_tasks > 5:
            recommendations.append("Consider breaking large tasks into smaller, manageable subtasks")

        if metrics['priority_distribution'].get('h-', 0) > 5:
            recommendations.append("Schedule dedicated time for high-priority tasks")

        if metrics['average_complexity'] > 6:
            recommendations.append("Allocate extra time for complex tasks and consider pair programming")

        pending_tasks = metrics['task_counts'].get('pending', 0)
        if pending_tasks > 10:
            recommendations.append("Review and prioritize pending tasks to reduce backlog")

        if metrics['memory_events'] < 5:
            recommendations.append("Increase development activity to improve learning patterns")

        return recommendations

    def _analyze_trends(self, cursor, timeframe: str) -> Dict[str, Any]:
        """Analyze trends over time"""
        trends = {}

        # Get previous period for comparison
        if timeframe == 'today':
            prev_start = (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            prev_end = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        elif timeframe == 'week':
            prev_start = datetime.now() - timedelta(days=14)
            prev_end = datetime.now() - timedelta(days=7)
        else:
            return trends  # No trend analysis for month/all

        # Compare completion rates
        cursor.execute("""
            SELECT
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(*) as total
            FROM task_contexts
            WHERE updated_at BETWEEN ? AND ?
        """, (prev_start.isoformat(), prev_end.isoformat()))

        prev_data = cursor.fetchone()
        if prev_data and prev_data[1] > 0:
            prev_completion_rate = prev_data[0] / prev_data[1]
            current_completion_rate = self._get_current_completion_rate(cursor, timeframe)

            trend_direction = "↗️" if current_completion_rate > prev_completion_rate else "↘️"
            trends['completion_trend'] = {
                'direction': trend_direction,
                'current': current_completion_rate,
                'previous': prev_completion_rate,
                'change': current_completion_rate - prev_completion_rate
            }

        return trends

    def _create_nl_summary(self, metrics: Dict[str, Any], insights: List[str], trends: Dict[str, Any]) -> str:
        """Create natural language summary"""
        total_tasks = metrics['total_tasks']
        completed = metrics['task_counts'].get('completed', 0)
        completion_rate = metrics['completion_rate']

        summary = f"📈 Progress Summary: {completed}/{total_tasks} tasks completed ({completion_rate:.1%}). "

        if insights:
            summary += f"Key insight: {insights[0]} "

        if trends.get('completion_trend'):
            trend = trends['completion_trend']
            summary += f"Completion rate trend: {trend['direction']} {trend['change']:+.1%}"

        return summary

    def _calculate_task_metrics(self, cursor, task_id: int, task_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate metrics for a specific task"""
        metrics = {}

        # Time tracking
        created_at = datetime.fromisoformat(task_dict['created_at'])
        updated_at = datetime.fromisoformat(task_dict['updated_at'])

        metrics['age_days'] = (datetime.now() - created_at).days
        metrics['last_updated_days'] = (datetime.now() - updated_at).days

        # Activity level
        cursor.execute("""
            SELECT COUNT(*) FROM cometa_memory_stream
            WHERE context_data LIKE ?
        """, (f"%{task_id}%",))

        metrics['activity_count'] = cursor.fetchone()[0]

        # Estimated vs actual (if completed)
        if task_dict['status'] == 'completed':
            estimated = task_dict.get('estimated_duration_minutes', 0)
            # Calculate actual duration from creation to completion
            actual_duration = (updated_at - created_at).total_seconds() / 60
            metrics['duration_accuracy'] = estimated / actual_duration if actual_duration > 0 else 0

        return metrics

    def _generate_task_insights(self, task_dict: Dict[str, Any], activities: List[Dict], metrics: Dict[str, Any]) -> List[str]:
        """Generate insights for a specific task"""
        insights = []

        # Age insights
        age_days = metrics.get('age_days', 0)
        if age_days > 7 and task_dict['status'] != 'completed':
            insights.append(f"⏰ Task is {age_days} days old. Consider prioritizing or breaking down.")

        # Activity insights
        activity_count = metrics.get('activity_count', 0)
        if activity_count == 0:
            insights.append("🔍 No recent activity detected. Task may need attention.")
        elif activity_count > 10:
            insights.append("🔥 High activity level. Task is actively being worked on.")

        # Status insights
        status = task_dict['status']
        if status == 'blocked':
            insights.append("🚫 Task is blocked. Identify and resolve dependencies.")
        elif status == 'in_progress' and metrics.get('last_updated_days', 0) > 2:
            insights.append("⚠️ In-progress task hasn't been updated recently.")

        return insights

    def _create_task_nl_summary(self, task_dict: Dict[str, Any], metrics: Dict[str, Any], insights: List[str]) -> str:
        """Create natural language summary for a task"""
        title = task_dict['title']
        status = task_dict['status']
        priority = task_dict['priority']
        age_days = metrics.get('age_days', 0)

        summary = f"📋 Task '{title}' ({priority}priority) - Status: {status}. Age: {age_days} days. "

        if insights:
            summary += f"Key insight: {insights[0]}"

        return summary

    # Additional helper methods for productivity analysis

    def _analyze_completion_patterns(self, cursor, user_id: str) -> Dict[str, Any]:
        """Analyze task completion patterns"""
        cursor.execute("""
            SELECT
                status,
                AVG(complexity_score) as avg_complexity,
                COUNT(*) as count
            FROM task_contexts
            GROUP BY status
        """)

        patterns = {}
        for row in cursor.fetchall():
            patterns[row[0]] = {
                'avg_complexity': row[1] or 0,
                'count': row[2]
            }

        return patterns

    def _analyze_time_patterns(self, cursor, user_id: str) -> Dict[str, Any]:
        """Analyze time-based productivity patterns"""
        # Simplified time analysis
        cursor.execute("""
            SELECT
                strftime('%H', created_at) as hour,
                COUNT(*) as task_count
            FROM task_contexts
            WHERE created_at > datetime('now', '-30 days')
            GROUP BY strftime('%H', created_at)
            ORDER BY task_count DESC
            LIMIT 5
        """)

        peak_hours = [{'hour': row[0], 'count': row[1]} for row in cursor.fetchall()]

        return {
            'peak_hours': peak_hours,
            'most_productive_hour': peak_hours[0]['hour'] if peak_hours else None
        }

    def _analyze_complexity_patterns(self, cursor) -> Dict[str, Any]:
        """Analyze relationship between complexity and completion"""
        cursor.execute("""
            SELECT
                complexity_score,
                status,
                COUNT(*) as count
            FROM task_contexts
            WHERE complexity_score IS NOT NULL
            GROUP BY complexity_score, status
        """)

        complexity_data = defaultdict(dict)
        for row in cursor.fetchall():
            complexity_data[row[0]][row[1]] = row[2]

        return dict(complexity_data)

    def _analyze_priority_effectiveness(self, cursor) -> Dict[str, Any]:
        """Analyze priority effectiveness"""
        cursor.execute("""
            SELECT
                priority,
                status,
                COUNT(*) as count
            FROM task_contexts
            GROUP BY priority, status
        """)

        priority_data = defaultdict(dict)
        for row in cursor.fetchall():
            priority_data[row[0]][row[1]] = row[2]

        return dict(priority_data)

    def _calculate_productivity_score(self, insights: Dict[str, Any]) -> float:
        """Calculate overall productivity score (0-100)"""
        # Simplified scoring algorithm
        base_score = 50

        completion_patterns = insights.get('completion_patterns', {})
        completed_count = completion_patterns.get('completed', {}).get('count', 0)
        total_count = sum(pattern.get('count', 0) for pattern in completion_patterns.values())

        if total_count > 0:
            completion_rate = completed_count / total_count
            base_score += (completion_rate - 0.5) * 50  # Adjust based on completion rate

        return max(0, min(100, base_score))

    def _create_productivity_summary(self, insights: Dict[str, Any]) -> str:
        """Create productivity summary"""
        score = insights.get('productivity_score', 50)
        peak_hour = insights.get('time_patterns', {}).get('most_productive_hour')

        summary = f"🎯 Productivity Score: {score:.1f}/100. "

        if peak_hour:
            summary += f"Most productive hour: {peak_hour}:00. "

        if score > 80:
            summary += "Excellent productivity! Keep up the great work."
        elif score > 60:
            summary += "Good productivity with room for improvement."
        else:
            summary += "Consider optimizing task management strategies."

        return summary

    def _get_current_completion_rate(self, cursor, timeframe: str) -> float:
        """Get current completion rate for trend analysis"""
        time_filter = self._get_time_filter(timeframe)

        cursor.execute("""
            SELECT
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(*) as total
            FROM task_contexts
            WHERE updated_at >= ?
        """, (time_filter['start_time'],))

        data = cursor.fetchone()
        return data[0] / data[1] if data[1] > 0 else 0

def main():
    """Entry point for CLI testing"""
    if len(sys.argv) < 2:
        print("Usage: python cometa-progress-tracker.py [summary|task_activity|productivity] [args...]")
        sys.exit(1)

    tracker = TaskProgressTracker(DB_PATH)
    command = sys.argv[1]

    if command == 'summary':
        timeframe = sys.argv[2] if len(sys.argv) > 2 else 'today'
        result = tracker.get_progress_summary(timeframe)
    elif command == 'task_activity':
        if len(sys.argv) < 3:
            print("Error: task_id required")
            sys.exit(1)
        task_id = int(sys.argv[2])
        result = tracker.track_task_activity(task_id)
    elif command == 'productivity':
        user_id = sys.argv[2] if len(sys.argv) > 2 else 'claude_user'
        result = tracker.get_productivity_insights(user_id)
    else:
        print(f"Error: Unknown command '{command}'")
        sys.exit(1)

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
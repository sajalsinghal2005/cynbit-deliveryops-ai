import { ListTodo, Clock3, CheckCircle2, Activity } from 'lucide-react';
import WelcomeBanner from '../components/dashboard/WelcomeBanner';
import StatCard from '../components/dashboard/StatCard';
import AgentActivityChart from '../components/dashboard/AgentActivityChart';
import RecentActivity from '../components/dashboard/RecentActivity';
import PendingApprovals from '../components/dashboard/PendingApprovals';
import QuickActions from '../components/dashboard/QuickActions';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* 1. Dashboard Hero / Welcome Banner */}
      <WelcomeBanner />

      {/* 2. KPI Cards (4 horizontal statistics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total tasks"
          value="128"
          change="18.4%"
          trend="up"
          description="Compared with last month"
          icon={ListTodo}
          sparklineData={[40, 48, 62, 58, 80, 75, 95, 128]}
          variant="indigo"
        />

        <StatCard
          title="Pending approvals"
          value="7"
          change="+2"
          trend="up"
          description="Require your attention"
          icon={Clock3}
          sparklineData={[3, 4, 2, 5, 4, 6, 5, 7]}
          variant="amber"
        />

        <StatCard
          title="Completed tasks"
          value="121"
          change="94.5%"
          trend="up"
          description="Successful execution rate"
          icon={CheckCircle2}
          sparklineData={[80, 85, 88, 90, 92, 95, 98, 121]}
          variant="emerald"
        />

        <StatCard
          title="Agent activity"
          value="342"
          change="24.8%"
          trend="up"
          description="Tool executions this week"
          icon={Activity}
          sparklineData={[120, 150, 190, 175, 230, 260, 290, 342]}
          variant="blue"
        />
      </div>

      {/* 3. Main Dashboard Grid (Two Column Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Large Card: Agent Activity Chart + Recent Activity */}
        <div className="lg:col-span-7 xl:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
          <AgentActivityChart />
          <RecentActivity />
        </div>

        {/* Right Large Card: Pending Approvals + AI Value Card */}
        <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <PendingApprovals />
        </div>
      </div>

      {/* 4. Quick Actions */}
      <QuickActions />
    </div>
  );
}
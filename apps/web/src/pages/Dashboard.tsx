import { Clock3, Activity, FolderKanban, AlertTriangle } from 'lucide-react';
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
          title="Delivery Projects"
          value="4"
          change="4 Clients"
          trend="up"
          description="EKS, React, Kafka, IoT"
          icon={FolderKanban}
          sparklineData={[1, 2, 2, 3, 3, 4, 4, 4]}
          variant="indigo"
        />

        <StatCard
          title="Pending Approvals"
          value="3"
          change="Protected"
          trend="up"
          description="Gated human review queue"
          icon={Clock3}
          sparklineData={[1, 2, 1, 3, 2, 3, 2, 3]}
          variant="amber"
        />

        <StatCard
          title="Active Blockers"
          value="3"
          change="1 Crit / 1 High"
          trend="down"
          description="Zephyr & Titan delivery risks"
          icon={AlertTriangle}
          sparklineData={[1, 1, 2, 2, 3, 3, 3, 3]}
          variant="amber"
        />

        <StatCard
          title="Agent Operations"
          value="342"
          change="24.8%"
          trend="up"
          description="Governed tool executions"
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
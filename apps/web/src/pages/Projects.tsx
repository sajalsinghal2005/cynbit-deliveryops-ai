import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Search,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  Layers,
  Bot,
  RefreshCw,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { api } from '../lib/api';
import type { ProjectItem } from '../types';

// Fallback seed data in case API is temporarily unavailable
const fallbackProjects: ProjectItem[] = [
  {
    id: 'PRJ-101',
    name: 'Project Falcon: Cloud Native Migration',
    description: 'Enterprise containerization and migration of core billing microservices to AWS EKS.',
    status: 'on_track',
    healthScore: 92,
    deliveryLead: 'Priya Nair',
    techStack: ['AWS EKS', 'Terraform', 'Node.js', 'PostgreSQL', 'Docker'],
    budget: '₹45,00,000',
    startDate: 'Aug 15, 2026',
    targetDate: 'Dec 15, 2026',
    customer: {
      id: '2',
      name: 'Ananya Iyer',
      company: 'ABC Technologies',
      email: 'ananya@abctech.io',
      status: 'active',
      aiHealthScore: 88,
    },
    progressPercent: 58,
    milestonesCount: 3,
    completedMilestonesCount: 1,
    delayedMilestonesCount: 0,
    openBlockersCount: 0,
    criticalBlockersCount: 0,
    highBlockersCount: 0,
    milestones: [
      { id: 'MS-101', title: 'Architecture Review & Infra Baseline', dueDate: 'Sep 15, 2026', status: 'completed', progressPercent: 100 },
      { id: 'MS-102', title: 'Data Migration & Schema Validation', dueDate: 'Oct 25, 2026', status: 'in_progress', progressPercent: 75 },
      { id: 'MS-103', title: 'Production Cutover & Sign-Off', dueDate: 'Dec 10, 2026', status: 'pending', progressPercent: 0 },
    ],
    blockers: [],
  },
  {
    id: 'PRJ-102',
    name: 'Project Zephyr: Omnichannel Customer Portal',
    description: 'Next-gen web & mobile portal for real-time customer onboarding and service tracking.',
    status: 'at_risk',
    healthScore: 68,
    deliveryLead: 'Arun Varma',
    techStack: ['React', 'React Native', 'Fastify', 'GraphQL', 'Redis'],
    budget: '₹28,50,000',
    startDate: 'Jul 1, 2026',
    targetDate: 'Nov 30, 2026',
    customer: {
      id: '1',
      name: 'Rahul Sharma',
      company: 'Sharma Infotech Pvt Ltd',
      email: 'rahul.s@sharmainfotech.in',
      status: 'active',
      aiHealthScore: 94,
    },
    progressPercent: 57,
    milestonesCount: 3,
    completedMilestonesCount: 1,
    delayedMilestonesCount: 1,
    openBlockersCount: 1,
    criticalBlockersCount: 0,
    highBlockersCount: 1,
    milestones: [
      { id: 'MS-201', title: 'UI/UX Design System Approval', dueDate: 'Aug 10, 2026', status: 'completed', progressPercent: 100 },
      { id: 'MS-202', title: 'Core Payment & Onboarding APIs', dueDate: 'Oct 5, 2026', status: 'delayed', progressPercent: 60 },
      { id: 'MS-203', title: 'End-to-End User Acceptance Testing', dueDate: 'Nov 15, 2026', status: 'pending', progressPercent: 10 },
    ],
    blockers: [
      {
        id: 'BLK-201',
        title: 'Third-Party KYC Sandbox Intermittent 504 Timeouts',
        description: 'Third-party vendor sandbox experiences intermittent gateway timeouts impacting onboarding test suite.',
        severity: 'HIGH',
        status: 'open',
        impact: 'Delaying MS-202 sign-off by 7 business days; client escalation pending.',
        identifiedDate: 'Oct 2, 2026',
      },
    ],
  },
  {
    id: 'PRJ-103',
    name: 'Project Titan: Real-time Analytics Engine',
    description: 'Distributed stream processing pipeline for campaign analytics and ad performance telemetry.',
    status: 'delayed',
    healthScore: 54,
    deliveryLead: 'Kavita Reddy',
    techStack: ['Apache Kafka', 'ClickHouse', 'Go', 'Python', 'Kubernetes'],
    budget: '₹62,00,000',
    startDate: 'Jun 1, 2026',
    targetDate: 'Oct 31, 2026',
    customer: {
      id: '3',
      name: 'Vikram Mehta',
      company: 'Zenith Media Global',
      email: 'vikram@zenithmedia.com',
      status: 'active',
      aiHealthScore: 96,
    },
    progressPercent: 50,
    milestonesCount: 3,
    completedMilestonesCount: 1,
    delayedMilestonesCount: 1,
    openBlockersCount: 2,
    criticalBlockersCount: 1,
    highBlockersCount: 0,
    milestones: [
      { id: 'MS-301', title: 'Event Pipeline Architecture PoC', dueDate: 'Jul 15, 2026', status: 'completed', progressPercent: 100 },
      { id: 'MS-302', title: 'Ad Impression Ingestion Pipeline', dueDate: 'Sep 30, 2026', status: 'delayed', progressPercent: 50 },
      { id: 'MS-303', title: 'Executive Reporting Dashboard', dueDate: 'Oct 28, 2026', status: 'pending', progressPercent: 0 },
    ],
    blockers: [
      {
        id: 'BLK-301',
        title: 'Client Network VPN Access Pending Security Review',
        description: 'Zenith InfoSec security review has halted staging cluster provisioning pending firewall rule approval.',
        severity: 'CRITICAL',
        status: 'open',
        impact: 'Full delivery halt on MS-302 ingestion testing; target release date compromised.',
        identifiedDate: 'Sep 25, 2026',
      },
      {
        id: 'BLK-302',
        title: 'Kafka Staging Cluster Resource Quota Reached',
        description: 'Staging Kafka cluster requires node scale-up to support stress test load.',
        severity: 'MEDIUM',
        status: 'in_progress',
        impact: 'Impacting high-volume load testing; awaiting cloud team quota increase.',
        identifiedDate: 'Oct 8, 2026',
      },
    ],
  },
  {
    id: 'PRJ-104',
    name: 'Project Apex: Supply Chain Tracking SDK',
    description: 'IoT event ingestion and tracking SDK for automated fleet management and freight dispatch.',
    status: 'on_track',
    healthScore: 96,
    deliveryLead: 'Priya Nair',
    techStack: ['TypeScript', 'Rust', 'MQTT', 'PostgreSQL', 'Docker'],
    budget: '₹35,00,000',
    startDate: 'Sep 1, 2026',
    targetDate: 'Jan 31, 2027',
    customer: {
      id: '4',
      name: 'Pooja Verma',
      company: 'Global Logistics Hub',
      email: 'pooja.v@globallogistics.co',
      status: 'inactive',
      aiHealthScore: 62,
    },
    progressPercent: 70,
    milestonesCount: 2,
    completedMilestonesCount: 1,
    delayedMilestonesCount: 0,
    openBlockersCount: 0,
    criticalBlockersCount: 0,
    highBlockersCount: 0,
    milestones: [
      { id: 'MS-401', title: 'Protocol Specification & Hardware Simulation', dueDate: 'Sep 30, 2026', status: 'completed', progressPercent: 100 },
      { id: 'MS-402', title: 'Fleet Telemetry Ingestion Service', dueDate: 'Nov 15, 2026', status: 'in_progress', progressPercent: 40 },
    ],
    blockers: [],
  },
];

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectItem[]>(fallbackProjects);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_track' | 'at_risk' | 'delayed'>('all');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; projects: ProjectItem[] }>('/api/projects');
      if (res.success && Array.isArray(res.projects) && res.projects.length > 0) {
        setProjects(res.projects);
      }
    } catch {
      // Fallback data is preserved
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      p.id.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query) ||
      p.deliveryLead.toLowerCase().includes(query) ||
      (p.customer?.company && p.customer.company.toLowerCase().includes(query)) ||
      p.techStack.some((t) => t.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  const totalAtRisk = projects.filter((p) => p.status === 'at_risk' || p.status === 'delayed').length;
  const totalOpenBlockers = projects.reduce((acc, p) => acc + (p.openBlockersCount || 0), 0);
  const avgHealth = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + p.healthScore, 0) / projects.length)
    : 0;

  const toggleExpand = (id: string) => {
    setExpandedProjectId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <FolderKanban size={19} strokeWidth={2.2} />
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">
              Delivery Operations & Projects
            </h1>
            <Badge variant="purple" size="sm" dot>
              Cynbit POC Domain
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-2xl">
            Authoritative software delivery portfolio tracking, milestone progress, and active blocker intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProjects}
            disabled={loading}
            className="border-slate-200 hover:border-slate-300"
          >
            <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </Button>

          <Button
            variant="purple-gradient"
            size="sm"
            icon={Bot}
            onClick={() => navigate('/agent')}
          >
            Ask AI Agent
          </Button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Projects</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Layers size={14} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{projects.length}</h3>
          <p className="text-[11px] text-slate-500 font-medium mt-1">4 technology client accounts</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Health</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 mt-2">{avgHealth}/100</h3>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">Portfolio health score</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">At Risk or Delayed</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock size={14} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-amber-600 mt-2">{totalAtRisk}</h3>
          <p className="text-[11px] text-amber-700 font-medium mt-1">Requires delivery attention</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Blockers</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle size={14} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-rose-600 mt-2">{totalOpenBlockers}</h3>
          <p className="text-[11px] text-rose-700 font-medium mt-1">1 Critical, 1 High severity</p>
        </div>
      </div>

      {/* 3. Search and Status Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project name, ID, client, lead, or tech stack (e.g., React, Kafka)..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['all', 'on_track', 'at_risk', 'delayed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Projects Cards Grid */}
      <div className="space-y-4">
        {filteredProjects.map((project) => {
          const isExpanded = expandedProjectId === project.id;
          const statusVariant =
            project.status === 'on_track'
              ? 'success'
              : project.status === 'at_risk'
              ? 'warning'
              : project.status === 'delayed'
              ? 'danger'
              : 'neutral';

          return (
            <div
              key={project.id}
              className="rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:border-slate-300 transition-all overflow-hidden"
            >
              {/* Card Header & Main Specs */}
              <div className="p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold font-mono text-sm ${
                        project.status === 'on_track'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : project.status === 'at_risk'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {project.id.replace('PRJ-', '#')}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">{project.name}</h2>
                        <Badge variant={statusVariant} size="sm" dot>
                          {project.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <span className="font-mono text-xs text-slate-400 font-semibold">{project.id}</span>
                      </div>

                      {project.description && (
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-3xl">
                          {project.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                        {project.customer && (
                          <span className="flex items-center gap-1.5 font-medium text-slate-700">
                            <Building2 size={13} className="text-slate-400" />
                            {project.customer.company} ({project.customer.name})
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          Target: <strong className="text-slate-700">{project.targetDate}</strong>
                        </span>
                        <span>
                          Lead: <strong className="text-slate-700">{project.deliveryLead}</strong>
                        </span>
                        {project.budget && (
                          <span>
                            Budget: <strong className="text-slate-700">{project.budget}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Action & Risk Indicators */}
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    {/* Health Score Pill */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center min-w-[90px]">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Health</span>
                      <p
                        className={`text-base font-bold ${
                          project.healthScore >= 90
                            ? 'text-emerald-600'
                            : project.healthScore >= 65
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {project.healthScore}/100
                      </p>
                    </div>

                    {/* Milestone Progress Pill */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center min-w-[100px]">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Milestones</span>
                      <p className="text-base font-bold text-indigo-600">
                        {project.completedMilestonesCount}/{project.milestonesCount}
                      </p>
                    </div>

                    {/* Blockers Pill */}
                    <div
                      className={`rounded-xl border p-2.5 text-center min-w-[90px] ${
                        project.openBlockersCount > 0
                          ? 'border-rose-200 bg-rose-50/60'
                          : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-slate-400">Blockers</span>
                      <p
                        className={`text-base font-bold ${
                          project.openBlockersCount > 0 ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        {project.openBlockersCount}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleExpand(project.id)}
                      className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition flex items-center gap-1 text-xs font-semibold"
                    >
                      <span>{isExpanded ? 'Hide' : 'Details'}</span>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Tech Stack Tags */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Stack:</span>
                    {project.techStack.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-700"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>

                  {/* AI Quick Query */}
                  <button
                    onClick={() => navigate('/agent')}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    <Sparkles size={13} />
                    <span>Ask AI Agent about {project.id}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>

              {/* Expandable Section: Milestones & Blockers */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-5 sm:p-6 space-y-5 animate-in fade-in duration-200">
                  {/* Milestones Subsection */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
                      <Clock size={14} className="text-indigo-600" />
                      <span>Delivery Milestones Timeline</span>
                    </h3>

                    <div className="grid gap-2.5 sm:grid-cols-3">
                      {project.milestones.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-indigo-600">{m.id}</span>
                            <Badge
                              variant={
                                m.status === 'completed'
                                  ? 'success'
                                  : m.status === 'in_progress'
                                  ? 'primary'
                                  : m.status === 'delayed'
                                  ? 'danger'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {m.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 line-clamp-1" title={m.title}>
                            {m.title}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Due: {m.dueDate}</span>
                            <span className="font-bold text-slate-700">{m.progressPercent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                m.status === 'completed'
                                  ? 'bg-emerald-500'
                                  : m.status === 'delayed'
                                  ? 'bg-rose-500'
                                  : 'bg-indigo-600'
                              }`}
                              style={{ width: `${m.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Blockers Subsection */}
                  {project.blockers.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-rose-600" />
                        <span>Active Delivery Blockers ({project.blockers.length})</span>
                      </h3>

                      <div className="space-y-2.5">
                        {project.blockers.map((b) => (
                          <div
                            key={b.id}
                            className="rounded-xl border border-rose-200 bg-white p-3.5 shadow-2xs space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  {b.id}
                                </span>
                                <span className="text-xs font-bold text-slate-900">{b.title}</span>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  b.severity === 'CRITICAL'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {b.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{b.description}</p>
                            <div className="text-[11px] text-rose-700 font-medium pt-1 border-t border-slate-100 flex items-center justify-between">
                              <span>Impact: {b.impact}</span>
                              <span className="text-slate-400">Identified: {b.identifiedDate}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

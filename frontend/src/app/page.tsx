import { Hero } from '@/components/dashboard/Hero';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { TransparencyCards } from '@/components/dashboard/TransparencyCards';

export default function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <Hero />
      <StatsOverview />
      <TransparencyCards />
    </div>
  );
}

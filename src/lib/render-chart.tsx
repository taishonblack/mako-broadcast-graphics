import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { VerticalBarChart } from '@/components/charts/VerticalBarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { PuckSlider } from '@/components/charts/PuckSlider';
import { PollOption, TemplateName } from '@/lib/types';

interface RenderChartProps {
  template: TemplateName;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  compact?: boolean;
}

export function renderChart({ template, options, totalVotes, colors, compact }: RenderChartProps) {
  switch (template) {
    case 'vertical-bar':
      return <VerticalBarChart options={options} totalVotes={totalVotes} colors={colors} />;
    case 'pie-donut':
      return <DonutChart options={options} totalVotes={totalVotes} colors={colors} size={compact ? 120 : 180} />;
    case 'progress-bar':
      return <HorizontalBarChart options={options} totalVotes={totalVotes} colors={colors} showPercent />;
    case 'puck-slider':
      return <PuckSlider options={options} totalVotes={totalVotes} colors={colors} />;
    case 'horizontal-bar':
    default:
      return <HorizontalBarChart options={options} totalVotes={totalVotes} colors={colors} showPercent showVotes />;
  }
}

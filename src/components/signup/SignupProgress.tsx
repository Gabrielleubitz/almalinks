import React from 'react';
import { Check, LucideIcon } from 'lucide-react';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  fields: string[];
}

interface SignupProgressProps {
  steps: Step[];
  currentStep: number;
  getStepStatus: (stepIndex: number) => 'completed' | 'current' | 'pending';
  isStepAccessible: (stepIndex: number) => boolean;
  onStepClick: (stepIndex: number) => void;
}

const SignupProgress: React.FC<SignupProgressProps> = ({
  steps,
  currentStep,
  getStepStatus,
  isStepAccessible,
  onStepClick
}) => {
  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center space-x-4 bg-white rounded-2xl shadow-lg p-4 border border-gray-200">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const isAccessible = isStepAccessible(index);
          const isClickable = isAccessible && index !== currentStep;
          
          return (
            <React.Fragment key={step.id}>
              {/* Step Circle */}
              <button
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={`
                  relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200
                  ${status === 'completed' 
                    ? 'bg-green-600 text-white shadow-lg' 
                    : status === 'current'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-110'
                    : isAccessible
                    ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    : 'bg-gray-100 text-gray-400'
                  }
                  ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                `}
                title={isClickable ? `Go to ${step.title}` : step.title}
              >
                {status === 'completed' ? (
                  <Check className="h-6 w-6" />
                ) : (
                  <step.icon className="h-6 w-6" />
                )}
                
                {/* Step Number Badge */}
                <div className={`
                  absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${status === 'completed' 
                    ? 'bg-green-500 text-white' 
                    : status === 'current'
                    ? 'bg-white text-brand-light shadow-md'
                    : 'bg-gray-300 text-gray-600'
                  }
                `}>
                  {index + 1}
                </div>
              </button>

              {/* Step Label - Only show for current step on mobile, all on desktop */}
              <div className={`
                transition-all duration-200
                ${status === 'current' ? 'block' : 'hidden lg:block'}
                ${isClickable ? 'cursor-pointer' : ''}
              `}>
                <button
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className="text-left"
                >
                  <div className={`
                    font-semibold text-sm transition-colors duration-200
                    ${status === 'completed' 
                      ? 'text-green-700' 
                      : status === 'current'
                      ? 'text-blue-700'
                      : isAccessible
                      ? 'text-gray-700 hover:text-brand-light'
                      : 'text-gray-400'
                    }
                  `}>
                    {step.title}
                  </div>
                  <div className={`
                    text-xs mt-1 transition-colors duration-200
                    ${status === 'completed' 
                      ? 'text-green-600' 
                      : status === 'current'
                      ? 'text-brand-light'
                      : 'text-gray-500'
                    }
                  `}>
                    {step.description}
                  </div>
                </button>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className={`
                  hidden lg:block w-12 h-1 rounded-full transition-colors duration-200
                  ${index < currentStep ? 'bg-green-400' : 'bg-gray-300'}
                `} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default SignupProgress;
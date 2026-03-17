import OpenAI from 'openai';

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'save_company_info',
      description: 'Lưu thông tin công ty khách hàng khi đã thu thập được',
      parameters: {
        type: 'object',
        properties: {
          company_name: { type: 'string', description: 'Tên công ty' },
          industry: { type: 'string', description: 'Ngành nghề' },
          company_size: { type: 'string', description: 'Quy mô (số nhân viên)' },
          address: { type: 'string', description: 'Địa chỉ' },
          business_model: { type: 'string', description: 'Mô hình kinh doanh' },
          current_systems: {
            type: 'array',
            items: { type: 'string' },
            description: 'Các hệ thống đang sử dụng',
          },
          pain_points: {
            type: 'array',
            items: { type: 'string' },
            description: 'Các khó khăn hiện tại',
          },
        },
        required: ['company_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_department_info',
      description: 'Lưu thông tin phòng ban',
      parameters: {
        type: 'object',
        properties: {
          departments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                head_count: { type: 'number' },
                manager: { type: 'string' },
                responsibilities: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        required: ['departments'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_workflow_info',
      description: 'Lưu thông tin quy trình làm việc',
      parameters: {
        type: 'object',
        properties: {
          workflow_name: { type: 'string' },
          description: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                step_order: { type: 'number' },
                action: { type: 'string' },
                responsible_department: { type: 'string' },
                tools_used: { type: 'string' },
              },
            },
          },
          pain_points: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_salary_info',
      description: 'Lưu thông tin cách tính lương',
      parameters: {
        type: 'object',
        properties: {
          salary_structure: { type: 'string', description: 'Cấu trúc lương' },
          components: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                calculation_method: { type: 'string' },
                conditions: { type: 'string' },
              },
            },
          },
          pay_cycle: { type: 'string' },
          special_rules: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_feature_request',
      description: 'Lưu yêu cầu tính năng cụ thể',
      parameters: {
        type: 'object',
        properties: {
          feature_name: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          user_stories: { type: 'array', items: { type: 'string' } },
          acceptance_criteria: { type: 'array', items: { type: 'string' } },
        },
        required: ['feature_name', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_scheduling_info',
      description: 'Lưu thông tin về lịch làm việc, deadline',
      parameters: {
        type: 'object',
        properties: {
          work_schedule: { type: 'string' },
          shift_types: { type: 'array', items: { type: 'string' } },
          deadline_management: { type: 'string' },
          calendar_requirements: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_special_requirements',
      description: 'Lưu yêu cầu đặc thù riêng của khách hàng',
      parameters: {
        type: 'object',
        properties: {
          requirement: { type: 'string' },
          category: { type: 'string' },
          details: { type: 'string' },
          constraints: { type: 'array', items: { type: 'string' } },
        },
        required: ['requirement'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_collection_progress',
      description: 'Kiểm tra tiến độ thu thập thông tin, xem còn thiếu gì',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
        },
        required: ['project_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_collection_complete',
      description: 'Đánh dấu thu thập hoàn tất khi đã đủ thông tin',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['project_id', 'summary'],
      },
    },
  },
];

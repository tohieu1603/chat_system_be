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
      name: 'save_employee_info',
      description: 'Lưu thông tin nhân sự: chức danh, vị trí, trách nhiệm',
      parameters: {
        type: 'object',
        properties: {
          positions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Chức danh (VD: Kế toán trưởng)' },
                department: { type: 'string', description: 'Phòng ban' },
                count: { type: 'number', description: 'Số lượng' },
                responsibilities: { type: 'array', items: { type: 'string' } },
              },
            },
            description: 'Danh sách vị trí/chức danh nhân viên',
          },
          total_employees: { type: 'number', description: 'Tổng số nhân viên' },
        },
        required: ['positions'],
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
      name: 'save_priority_info',
      description: 'Lưu thông tin ưu tiên, timeline, ngân sách của dự án',
      parameters: {
        type: 'object',
        properties: {
          priorities: {
            type: 'array',
            items: { type: 'string' },
            description: 'Thứ tự ưu tiên tính năng/module',
          },
          timeline: { type: 'string', description: 'Timeline dự kiến (VD: 2 tháng)' },
          budget: { type: 'string', description: 'Ngân sách dự kiến' },
          deadline: { type: 'string', description: 'Deadline cụ thể' },
          go_live_date: { type: 'string', description: 'Ngày dự kiến go-live' },
        },
        required: ['timeline'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_integration_info',
      description: 'Lưu yêu cầu tích hợp hệ thống bên ngoài (API, phần mềm, thiết bị)',
      parameters: {
        type: 'object',
        properties: {
          integrations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                system_name: { type: 'string', description: 'Tên hệ thống (VD: ZKTeco, SAP, Misa)' },
                type: { type: 'string', description: 'Loại: API, hardware, software, payment' },
                purpose: { type: 'string', description: 'Mục đích tích hợp' },
                current_status: { type: 'string', description: 'Đang dùng hay mới' },
              },
            },
          },
        },
        required: ['integrations'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_security_requirements',
      description: 'Lưu yêu cầu bảo mật, quyền truy cập, tuân thủ pháp luật',
      parameters: {
        type: 'object',
        properties: {
          authentication: { type: 'string', description: 'Phương thức xác thực (password, OTP, SSO)' },
          roles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role_name: { type: 'string' },
                permissions: { type: 'array', items: { type: 'string' } },
              },
            },
            description: 'Phân quyền người dùng',
          },
          data_privacy: { type: 'string', description: 'Yêu cầu bảo mật dữ liệu' },
          compliance: { type: 'array', items: { type: 'string' }, description: 'Tuân thủ (PDPA, ISO...)' },
          backup_requirements: { type: 'string', description: 'Yêu cầu sao lưu' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_ui_requirements',
      description: 'Lưu yêu cầu giao diện, trải nghiệm người dùng (UI/UX)',
      parameters: {
        type: 'object',
        properties: {
          platforms: {
            type: 'array',
            items: { type: 'string' },
            description: 'Nền tảng: web, mobile, tablet, desktop',
          },
          design_preferences: { type: 'string', description: 'Phong cách thiết kế mong muốn' },
          branding: {
            type: 'object',
            properties: {
              primary_color: { type: 'string' },
              logo_url: { type: 'string' },
              brand_name: { type: 'string' },
            },
            description: 'Thông tin thương hiệu',
          },
          accessibility: { type: 'string', description: 'Yêu cầu tiếp cận (đa ngôn ngữ, font lớn...)' },
          reference_sites: {
            type: 'array',
            items: { type: 'string' },
            description: 'Website tham khảo thiết kế',
          },
        },
        required: ['platforms'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_report_requirements',
      description: 'Lưu yêu cầu báo cáo, thống kê, dashboard',
      parameters: {
        type: 'object',
        properties: {
          reports: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                report_name: { type: 'string', description: 'Tên báo cáo' },
                frequency: { type: 'string', description: 'Tần suất: daily, weekly, monthly' },
                recipients: { type: 'array', items: { type: 'string' }, description: 'Ai xem' },
                metrics: { type: 'array', items: { type: 'string' }, description: 'Chỉ số cần theo dõi' },
              },
            },
          },
          dashboard_needs: { type: 'string', description: 'Yêu cầu dashboard tổng quan' },
          export_formats: { type: 'array', items: { type: 'string' }, description: 'Định dạng xuất: PDF, Excel, CSV' },
        },
        required: ['reports'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_notification_requirements',
      description: 'Lưu yêu cầu thông báo, cảnh báo, nhắc nhở',
      parameters: {
        type: 'object',
        properties: {
          channels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Kênh thông báo: email, SMS, push, Zalo, Telegram',
          },
          triggers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                event: { type: 'string', description: 'Sự kiện trigger' },
                channel: { type: 'string', description: 'Kênh gửi' },
                recipients: { type: 'string', description: 'Người nhận' },
              },
            },
            description: 'Danh sách trigger thông báo',
          },
        },
        required: ['channels'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_data_migration_info',
      description: 'Lưu yêu cầu chuyển đổi/nhập dữ liệu từ hệ thống cũ',
      parameters: {
        type: 'object',
        properties: {
          source_systems: {
            type: 'array',
            items: { type: 'string' },
            description: 'Hệ thống nguồn (Excel, phần mềm cũ...)',
          },
          data_types: {
            type: 'array',
            items: { type: 'string' },
            description: 'Loại dữ liệu cần chuyển (nhân viên, lương, khách hàng...)',
          },
          volume: { type: 'string', description: 'Khối lượng dữ liệu ước tính' },
          timeline: { type: 'string', description: 'Thời gian chuyển đổi' },
        },
        required: ['source_systems'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_features',
      description: 'Gợi ý tính năng phù hợp dựa trên ngành nghề và yêu cầu đã thu thập. Dùng khi muốn đề xuất thêm cho khách hàng.',
      parameters: {
        type: 'object',
        properties: {
          industry: { type: 'string', description: 'Ngành nghề' },
          current_features: { type: 'array', items: { type: 'string' }, description: 'Tính năng đã yêu cầu' },
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                feature_name: { type: 'string' },
                reason: { type: 'string', description: 'Lý do gợi ý' },
                priority: { type: 'string', description: 'HIGH, MEDIUM, LOW' },
              },
            },
            description: 'Danh sách tính năng gợi ý',
          },
        },
        required: ['suggestions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_collection_complete',
      description: 'Đánh dấu thu thập hoàn tất khi đã đủ 6 mục bắt buộc (COMPANY_INFO, DEPARTMENTS, EMPLOYEES, WORKFLOWS, FEATURES, PRIORITIES)',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          summary: { type: 'string', description: 'Tóm tắt yêu cầu dự án' },
        },
        required: ['summary'],
      },
    },
  },
];

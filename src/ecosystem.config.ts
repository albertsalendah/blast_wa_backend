module.exports = {
    apps: [
      {
        name: 'wa-blast-backend',
        script: 'dist/index.js',
        watch: ['dist'],
        ignore_watch: ['files/upload', 'files/input_list_nomor','files/output_list_nomor'],
        restart_delay: 30000,
        autorestart: true,
        exec_mode: 'fork',
        instances: 1,
        merge_logs: true,
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        error_file: 'logs/error.log',
        out_file: 'logs/out.log',
      },
    ],
  };

  
  
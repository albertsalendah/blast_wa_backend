export const daftarNO = ['082138345212', '082138345212', '62821_3834_5212', '000', '0821345212', '0000', '082138345212', '.0821/3834/5212', '0.8.2.1.3.8.3.4.5.2.1', '082138345212',]
const datas = [
    {
        "No_Pendaftaran": "01",
        "Nama_Pendaftar": "Richard Salendah 01",
        "No_HP": "082138345212",
        "Tahun_Akademik": "2023-2024",
        "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
        "Prodi_Registrasi_Ulang": "702023003"
    }
    // ,{
    //     "No_Pendaftaran": "01",
    //     "Nama_Pendaftar": "Richard Salendah 01",
    //     "No_HP": "08213845212",
    //     "Tahun_Akademik": "2023-2024",
    //     "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
    //     "Prodi_Registrasi_Ulang": "702023003"
    // },{
    //     "No_Pendaftaran": "01",
    //     "Nama_Pendaftar": "Richard Salendah 01",
    //     "No_HP": "082138345212",
    //     "Tahun_Akademik": "2023-2024",
    //     "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
    //     "Prodi_Registrasi_Ulang": "702023003"
    // },{
    //     "No_Pendaftaran": "01",
    //     "Nama_Pendaftar": "Richard Salendah 01",
    //     "No_HP": "08213834521",
    //     "Tahun_Akademik": "2023-2024",
    //     "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
    //     "Prodi_Registrasi_Ulang": "702023003"
    // },
//     {
//         "No_Pendaftaran": "02",
//         "Nama_Pendaftar": "Ocha",
//         "No_HP": "08112822278",
//         "Tahun_Akademik": "2023-2024",
//         "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
//         "Prodi_Registrasi_Ulang": "702023003"
//    },
//      {
//         "No_Pendaftaran": "03",
//         "Nama_Pendaftar": "Nina",
//         "No_HP": "085640551818",
//         "Tahun_Akademik": "2023-2024",
//         "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
//         "Prodi_Registrasi_Ulang": "702023003"
//     },
//     {
//         "No_Pendaftaran": "04",
//         "Nama_Pendaftar": " ",
//         "No_HP": "6285877543639",
//         "Tahun_Akademik": "2023-2024",
//         "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
//         "Prodi_Registrasi_Ulang": "702023003"
//     },
//     {
//         "No_Pendaftaran":"06",
//         "Nama_Pendaftar": " ",
//         "No_HP": "6285641064228",
//         "Tahun_Akademik":"2023-2024",
//         "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
//         "Prodi_Registrasi_Ulang": "702023003"
//     },
//     {
//         "No_Pendaftaran":"07",
//         "Nama_Pendaftar": " ",
//         "No_HP": "6285865780807",
//         "Tahun_Akademik":"2023-2024",
//         "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
//         "Prodi_Registrasi_Ulang": "702023003"
//     },
//     {
//         "No_Pendaftaran":"08",
//         "Nama_Pendaftar": " ",
//         "No_HP": "08112822278",
//         "Tahun_Akademik":"2023-2024",
//         "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
//         "Prodi_Registrasi_Ulang": "702023003"
//     },
//     {
//         "No_Pendaftaran":"09",
//         "Nama_Pendaftar": " ",
//         "No_HP": "085640551818",
//         "Tahun_Akademik":"2023-2024",
//         "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
//         "Prodi_Registrasi_Ulang": "702023003"
//     },{
//         "No_Pendaftaran":"10",
//         "Nama_Pendaftar": " ",
//         "No_HP": "085394307363",
//         "Tahun_Akademik":"2023-2024",
//         "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
//         "Prodi_Registrasi_Ulang": "702023003"
//     },{
//         "No_Pendaftaran":"11",
//         "Nama_Pendaftar": " ",
//         "No_HP": "085600088225",
//         "Tahun_Akademik":"2023-2024",
//         "Status_Registrasi_Ulang": "Diterima - PEMAMIK 7 2023",
//         "Prodi_Registrasi_Ulang": "702023003"
//     },
];

export const applicants = datas.map((data) => ({
    No_Pendaftaran: data.No_Pendaftaran,
    Nama_Pendaftar: data.Nama_Pendaftar,
    No_HP: [data.No_HP],
    Tahun_Akademik: data.Tahun_Akademik,
    Status_Registrasi_Ulang: data.Status_Registrasi_Ulang,
    Prodi_Registrasi_Ulang: data.Prodi_Registrasi_Ulang
}));

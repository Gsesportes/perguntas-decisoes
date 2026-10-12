using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.IO;
using System.Web.Script.Serialization;

public static class CapturaMicrofone
{
    [StructLayout(LayoutKind.Sequential, Pack = 2)]
    private struct FormatoAudio
    {
        public ushort tipo, canais;
        public uint amostragem, bytesPorSegundo;
        public ushort alinhamento, bits, extras;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Cabecalho
    {
        public IntPtr dados;
        public uint capacidade, gravados;
        public IntPtr usuario;
        public uint flags, repeticoes;
        public IntPtr proximo, reservado;
    }

    private sealed class BufferAudio
    {
        public IntPtr dados, cabecalho;
        public bool preparado, consumido;
    }

    [DllImport("winmm.dll")] private static extern uint waveInGetNumDevs();
    [DllImport("winmm.dll")] private static extern uint waveInOpen(out IntPtr handle, uint dispositivo, ref FormatoAudio formato, IntPtr callback, IntPtr instancia, uint flags);
    [DllImport("winmm.dll")] private static extern uint waveInPrepareHeader(IntPtr handle, IntPtr cabecalho, uint tamanho);
    [DllImport("winmm.dll")] private static extern uint waveInAddBuffer(IntPtr handle, IntPtr cabecalho, uint tamanho);
    [DllImport("winmm.dll")] private static extern uint waveInStart(IntPtr handle);
    [DllImport("winmm.dll")] private static extern uint waveInStop(IntPtr handle);
    [DllImport("winmm.dll")] private static extern uint waveInReset(IntPtr handle);
    [DllImport("winmm.dll")] private static extern uint waveInUnprepareHeader(IntPtr handle, IntPtr cabecalho, uint tamanho);
    [DllImport("winmm.dll")] private static extern uint waveInClose(IntPtr handle);
    [DllImport("winmm.dll", CharSet = CharSet.Unicode)] private static extern uint waveInGetErrorTextW(uint codigo, StringBuilder texto, uint tamanho);

    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 4000000 };
    private static readonly uint TamanhoCabecalho = (uint)Marshal.SizeOf(typeof(Cabecalho));
    private static readonly ManualResetEvent Cancelar = new ManualResetEvent(false);
    private static readonly ManualResetEvent Parar = new ManualResetEvent(false);
    private static readonly MemoryStream Audio = new MemoryStream();
    private static volatile bool Encerrando;
    private static long Amostras;
    private static double SomaQuadrados, Pico;

    private static void Emitir(object valor) { Console.WriteLine(Json.Serialize(valor)); Console.Out.Flush(); }
    private static void Conferir(uint codigo, string operacao)
    {
        if (codigo == 0) return;
        var texto = new StringBuilder(256);
        waveInGetErrorTextW(codigo, texto, 256);
        throw new InvalidOperationException(operacao + ": " + codigo + " — " + texto.ToString());
    }

    private static void Medir(BufferAudio buffer)
    {
        var cabecalho = (Cabecalho)Marshal.PtrToStructure(buffer.cabecalho, typeof(Cabecalho));
        if ((cabecalho.flags & 1) == 0 || buffer.consumido) return;
        buffer.consumido = true;
        if (cabecalho.gravados > cabecalho.capacidade || (cabecalho.gravados % 2) != 0) throw new InvalidOperationException("O driver retornou um tamanho de áudio inválido.");
        if (Audio.Length + cabecalho.gravados > 1952000) throw new InvalidOperationException("A captura ultrapassou sessenta segundos.");
        var trecho = new byte[cabecalho.gravados];
        Marshal.Copy(buffer.dados, trecho, 0, trecho.Length);
        Audio.Write(trecho, 0, trecho.Length);
        Array.Clear(trecho, 0, trecho.Length);
        for (int i = 0; i < cabecalho.gravados; i += 2)
        {
            double valor = Marshal.ReadInt16(buffer.dados, i) / 32768.0;
            SomaQuadrados += valor * valor;
            Pico = Math.Max(Pico, Math.Abs(valor));
            Amostras++;
        }
    }

    public static int Main(string[] argumentos)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        var resultado = new Dictionary<string, object>();
        resultado["capturado"] = false;
        resultado["dispositivo_fechado"] = false;
        IntPtr dispositivo = IntPtr.Zero;
        var buffers = new List<BufferAudio>();
        var eventoAudio = new AutoResetEvent(false);
        var errosLimpeza = new List<string>();
        Mutex exclusao = null;
        bool possuiMutex = false;
        int codigoSaida = 1;
        try
        {
            if (argumentos.Length == 1 && argumentos[0] == "verificar")
            {
                Emitir(new { evento = "verificacao", entradas_audio = waveInGetNumDevs(), captura_iniciada = false });
                return 0;
            }
            int duracao;
            if (argumentos.Length != 1 || !Int32.TryParse(argumentos[0], out duracao) || duracao < 100 || duracao > 60000) throw new ArgumentException("Informe duração entre 100 e 60000 milissegundos.");
            exclusao = new Mutex(false, "Local\\PerguntasDecisoes.Microfone.Prototipo");
            try { possuiMutex = exclusao.WaitOne(0); }
            catch (AbandonedMutexException) { possuiMutex = true; resultado["sessao_anterior_interrompida"] = true; }
            if (!possuiMutex) throw new InvalidOperationException("Já existe uma captura ativa neste plugin.");
            if (waveInGetNumDevs() == 0) throw new InvalidOperationException("Nenhuma entrada de áudio foi encontrada.");

            var formato = new FormatoAudio { tipo = 1, canais = 1, amostragem = 16000, bytesPorSegundo = 32000, alinhamento = 2, bits = 16, extras = 0 };
            Conferir(waveInOpen(out dispositivo, UInt32.MaxValue, ref formato, eventoAudio.SafeWaitHandle.DangerousGetHandle(), IntPtr.Zero, 0x00050000), "Abrir microfone");
            for (int i = 0; i < 4; i++)
            {
                var buffer = new BufferAudio { dados = Marshal.AllocHGlobal(3200), cabecalho = Marshal.AllocHGlobal((int)TamanhoCabecalho) };
                buffers.Add(buffer);
                Marshal.StructureToPtr(new Cabecalho { dados = buffer.dados, capacidade = 3200 }, buffer.cabecalho, false);
                Conferir(waveInPrepareHeader(dispositivo, buffer.cabecalho, TamanhoCabecalho), "Preparar buffer");
                buffer.preparado = true;
                Conferir(waveInAddBuffer(dispositivo, buffer.cabecalho, TamanhoCabecalho), "Entregar buffer ao driver");
            }
            var controle = new Thread(delegate()
            {
                try
                {
                    for (;;)
                    {
                        string linha = Console.ReadLine();
                        if (Encerrando) return;
                        if (linha == null || linha.Trim() == "cancelar") { Cancelar.Set(); return; }
                        if (linha.Trim() == "parar") { Parar.Set(); return; }
                    }
                }
                catch (Exception erro) { if (!Encerrando) { Console.Error.WriteLine("Falha no controle: " + erro.Message); Cancelar.Set(); } }
            });
            controle.IsBackground = true;
            controle.Start();
            var tempo = Stopwatch.StartNew();
            Conferir(waveInStart(dispositivo), "Iniciar captura");
            Emitir(new { evento = "gravando", duracao_maxima_ms = duracao, amostragem_hz = 16000, canais = 1, bits = 16 });
            while (tempo.ElapsedMilliseconds < duracao && !Cancelar.WaitOne(0) && !Parar.WaitOne(0))
            {
                eventoAudio.WaitOne(40);
                foreach (var buffer in buffers)
                {
                    var cabecalho = (Cabecalho)Marshal.PtrToStructure(buffer.cabecalho, typeof(Cabecalho));
                    if ((cabecalho.flags & 1) == 0) continue;
                    Medir(buffer);
                    if (tempo.ElapsedMilliseconds >= duracao || Cancelar.WaitOne(0) || Parar.WaitOne(0)) break;
                    Conferir(waveInAddBuffer(dispositivo, buffer.cabecalho, TamanhoCabecalho), "Renovar buffer");
                    buffer.consumido = false;
                }
            }
            resultado["duracao_ms"] = tempo.ElapsedMilliseconds;
            resultado["cancelado"] = Cancelar.WaitOne(0);
            codigoSaida = (bool)resultado["cancelado"] ? 2 : 0;
        }
        catch (Exception erro) { resultado["erro"] = erro.GetType().Name + ": " + erro.Message; }
        finally
        {
            Encerrando = true;
            if (dispositivo != IntPtr.Zero)
            {
                uint parar = waveInStop(dispositivo);
                if (parar != 0) errosLimpeza.Add("Falha ao parar dispositivo: " + parar);
                uint reiniciar = waveInReset(dispositivo);
                if (reiniciar != 0) errosLimpeza.Add("Falha ao devolver buffers: " + reiniciar);
                foreach (var buffer in buffers)
                {
                    try { Medir(buffer); }
                    catch (Exception erro) { errosLimpeza.Add(erro.Message); }
                    if (buffer.preparado)
                    {
                        uint liberar = waveInUnprepareHeader(dispositivo, buffer.cabecalho, TamanhoCabecalho);
                        if (liberar != 0) errosLimpeza.Add("Falha ao liberar buffer: " + liberar);
                    }
                }
                uint fechar = waveInClose(dispositivo);
                resultado["dispositivo_fechado"] = fechar == 0;
                if (fechar != 0) errosLimpeza.Add("Falha ao fechar microfone: " + fechar);
            }
            if (dispositivo == IntPtr.Zero || (bool)resultado["dispositivo_fechado"])
            {
                foreach (var buffer in buffers) { Marshal.FreeHGlobal(buffer.cabecalho); Marshal.FreeHGlobal(buffer.dados); }
                eventoAudio.Dispose();
            }
            bool liberado = dispositivo == IntPtr.Zero || (bool)resultado["dispositivo_fechado"];
            if (possuiMutex && liberado) exclusao.ReleaseMutex();
            if (exclusao != null && (!possuiMutex || liberado)) exclusao.Dispose();
        }
        double rms = Amostras > 0 ? Math.Sqrt(SomaQuadrados / Amostras) : 0;
        resultado["amostras"] = Amostras;
        resultado["bytes_capturados"] = Amostras * 2;
        resultado["pico"] = Math.Round(Pico, 6);
        resultado["rms"] = Math.Round(rms, 6);
        resultado["sinal_detectado"] = Pico > 0.005;
        resultado["formato"] = "PCM 16 bits, mono, 16000 Hz";
        resultado["audio_salvo"] = false;
        resultado["audio_transmitido"] = false;
        if (errosLimpeza.Count > 0) { resultado["erros_encerramento"] = errosLimpeza; codigoSaida = 1; }
        if (codigoSaida == 0 && Amostras == 0) { resultado["erro"] = "A captura não retornou amostras de áudio."; codigoSaida = 1; }
        resultado["capturado"] = Amostras > 0;
        if (codigoSaida == 0) resultado["audio_base64"] = Convert.ToBase64String(Audio.GetBuffer(), 0, (int)Audio.Length);
        Array.Clear(Audio.GetBuffer(), 0, (int)Audio.Length);
        Audio.Dispose();
        Emitir(new { evento = "concluido", resultado = resultado });
        return codigoSaida;
    }
}

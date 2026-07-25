using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace EnduranceFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "event_id",
                table: "round",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "event",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "text", nullable: false),
                    circuit = table.Column<string>(type: "text", nullable: true),
                    starts_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ends_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_round_event_id",
                table: "round",
                column: "event_id");

            migrationBuilder.AddForeignKey(
                name: "fk_round_event_event_id",
                table: "round",
                column: "event_id",
                principalTable: "event",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_round_event_event_id",
                table: "round");

            migrationBuilder.DropTable(
                name: "event");

            migrationBuilder.DropIndex(
                name: "ix_round_event_id",
                table: "round");

            migrationBuilder.DropColumn(
                name: "event_id",
                table: "round");
        }
    }
}
